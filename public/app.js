const form = document.getElementById('taxForm');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');

function formatMoney(value) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function renderResult(data) {
  const t = data.tax;

  const baseLines = [
    `Период: ${data.period.dateFrom} → ${data.period.dateTo}`,
    `Строк WB: ${data.source.rowsCount}`,
    `Доход: ${formatMoney(data.income)}`,
    `Расходы всего: ${formatMoney(data.expensesBreakdown.total)}`,
    `Налоговый режим: ${t.regimeLabel}`,
    `Итоговый налог к уплате: ${formatMoney(t.finalTax)}`
  ];

  if (typeof t.taxBeforeReduction !== 'undefined') {
    baseLines.push(`Налог до уменьшения: ${formatMoney(t.taxBeforeReduction)}`);
    baseLines.push(`Уменьшение на взносы: ${formatMoney(t.reduction)}`);
  }

  if (typeof t.tax15 !== 'undefined') {
    baseLines.push(`Налог по ставке 15%: ${formatMoney(t.tax15)}`);
    baseLines.push(`Минимальный налог 1%: ${formatMoney(t.minTax)}`);
  }

  resultEl.innerHTML = `
    <h2>Результат</h2>
    <pre>${baseLines.join('\n')}</pre>
    <h3>Детали</h3>
    <pre>${JSON.stringify(data, null, 2)}</pre>
  `;
  resultEl.classList.remove('hidden');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  statusEl.textContent = 'Считаю...';
  resultEl.classList.add('hidden');

  const payload = {
    apiKey: document.getElementById('apiKey').value.trim(),
    dateFrom: document.getElementById('dateFrom').value,
    dateTo: document.getElementById('dateTo').value,
    regime: document.getElementById('regime').value,
    insurancePaid: Number(document.getElementById('insurancePaid').value || 0),
    manualExpenses: Number(document.getElementById('manualExpenses').value || 0),
    includeReturnsAsNegativeIncome: document.getElementById('includeReturns').checked
  };

  try {
    const response = await fetch('/api/wb-tax/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.details || data.error || 'Ошибка запроса');
    }

    renderResult(data);
    statusEl.textContent = 'Готово.';
  } catch (error) {
    statusEl.textContent = `Ошибка: ${error.message}`;
  }
});
