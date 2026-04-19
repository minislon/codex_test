const counterValue = document.getElementById('counterValue');
const increaseBtn = document.getElementById('increaseBtn');
const decreaseBtn = document.getElementById('decreaseBtn');
const resetBtn = document.getElementById('resetBtn');

let value = 0;

function renderCounter() {
  counterValue.textContent = value;
  counterValue.classList.remove('counter__value--pulse');
  void counterValue.offsetWidth;
  counterValue.classList.add('counter__value--pulse');
}

increaseBtn.addEventListener('click', () => {
  value += 1;
  renderCounter();
});

decreaseBtn.addEventListener('click', () => {
  value -= 1;
  renderCounter();
});

resetBtn.addEventListener('click', () => {
  value = 0;
  renderCounter();
});

renderCounter();
