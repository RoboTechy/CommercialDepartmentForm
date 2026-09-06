document.addEventListener('click', function (e) {
  var btn = e.target.closest('.today-btn');
  if (!btn) return;
  var wrapper = btn.closest('.jalali-date-input');
  var input = wrapper && wrapper.querySelector('input');
  if (input) input.value = btn.dataset.today;
});
