const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));

function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = String(value).replace(/\s/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sumByKeys(rows, keys) {
  return rows.reduce((acc, row) => {
    for (const key of keys) {
      acc += toNumber(row[key]);
    }
    return acc;
  }, 0);
}

function calculateTax({ regime, taxableIncome, expenses, insurancePaid }) {
  if (regime === 'usn_income') {
    const taxBeforeReduction = taxableIncome * 0.06;
    const reduction = Math.min(taxBeforeReduction, insurancePaid);
    return {
      regimeLabel: 'УСН Доходы 6%',
      taxBeforeReduction,
      reduction,
      finalTax: Math.max(0, taxBeforeReduction - reduction)
    };
  }

  if (regime === 'usn_income_expenses') {
    const base = Math.max(0, taxableIncome - expenses);
    const tax15 = base * 0.15;
    const minTax = taxableIncome * 0.01;
    return {
      regimeLabel: 'УСН Доходы-Расходы 15%',
      taxBase: base,
      tax15,
      minTax,
      finalTax: Math.max(tax15, minTax)
    };
  }

  throw new Error('Неподдерживаемый налоговый режим');
}

app.post('/api/wb-tax/calculate', async (req, res) => {
  try {
    const {
      apiKey,
      dateFrom,
      dateTo,
      regime,
      insurancePaid = 0,
      manualExpenses = 0,
      includeReturnsAsNegativeIncome = true
    } = req.body;

    if (!apiKey || !dateFrom || !dateTo || !regime) {
      return res.status(400).json({ error: 'apiKey, dateFrom, dateTo и regime обязательны' });
    }

    const wbResponse = await fetch('https://statistics-api.wildberries.ru/api/v5/supplier/reportDetailByPeriod?' + new URLSearchParams({
      dateFrom,
      dateTo,
      limit: '100000',
      rrdid: '0'
    }), {
      method: 'GET',
      headers: {
        Authorization: apiKey
      }
    });

    if (!wbResponse.ok) {
      const body = await wbResponse.text();
      return res.status(wbResponse.status).json({
        error: 'Ошибка WB API',
        details: body.slice(0, 1000)
      });
    }

    const rows = await wbResponse.json();
    if (!Array.isArray(rows)) {
      return res.status(502).json({ error: 'WB API вернул неожиданный формат данных' });
    }

    const grossSales = sumByKeys(rows, ['retail_amount', 'retail_price_withdisc_rub']);
    const returns = sumByKeys(rows, ['return_amount']);
    const wbCommission = sumByKeys(rows, ['commission_percent', 'ppvz_sales_commission']);
    const logistics = sumByKeys(rows, ['delivery_rub']);
    const penalties = sumByKeys(rows, ['penalty']);
    const acquiring = sumByKeys(rows, ['acquiring_fee']);

    const income = includeReturnsAsNegativeIncome
      ? Math.max(0, grossSales - returns)
      : grossSales;

    const expenses = manualExpenses + wbCommission + logistics + penalties + acquiring;

    const tax = calculateTax({
      regime,
      taxableIncome: income,
      expenses,
      insurancePaid: toNumber(insurancePaid)
    });

    res.json({
      period: { dateFrom, dateTo },
      source: {
        endpoint: '/api/v5/supplier/reportDetailByPeriod',
        rowsCount: rows.length
      },
      income,
      returns,
      grossSales,
      expensesBreakdown: {
        manualExpenses: toNumber(manualExpenses),
        wbCommission,
        logistics,
        penalties,
        acquiring,
        total: expenses
      },
      tax,
      disclaimer: 'Расчёт предварительный. Для подачи отчётности сверяйте цифры с бухгалтером и актуальными правилами ФНС.'
    });
  } catch (error) {
    res.status(500).json({ error: 'Внутренняя ошибка', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`WB tax app started on http://localhost:${PORT}`);
});
