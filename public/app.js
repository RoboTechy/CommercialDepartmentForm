document.addEventListener('click', function (e) {
  var btn = e.target.closest('.today-btn');
  if (!btn) return;
  var wrapper = btn.closest('.jalali-date-input');
  var input = wrapper && wrapper.querySelector('input');
  if (input) input.value = btn.dataset.today;
});

// --- تقویم تعاملی شمسی (باز شدن با کلیک روی فیلدهای تاریخ) ---
(function () {
  var popup = null;
  var activeInput = null;
  var viewYear = null;
  var viewMonth = null;

  function parseInputDate(input) {
    var m = /^(\d{3,4})\/(\d{1,2})\/(\d{1,2})$/.exec((input.value || '').trim());
    if (!m) return null;
    return { y: parseInt(m[1], 10), m: parseInt(m[2], 10), d: parseInt(m[3], 10) };
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function closePopup() {
    if (popup) {
      popup.remove();
      popup = null;
    }
    activeInput = null;
    document.removeEventListener('keydown', onKeyDown);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') closePopup();
  }

  function positionPopup() {
    if (!popup || !activeInput) return;
    var rect = activeInput.getBoundingClientRect();
    var popupHeight = popup.offsetHeight || 300;
    var spaceBelow = window.innerHeight - rect.bottom;
    var top;
    if (spaceBelow < popupHeight + 10 && rect.top > popupHeight + 10) {
      top = rect.top - popupHeight - 4;
    } else {
      top = rect.bottom + 4;
    }
    popup.style.position = 'fixed';
    popup.style.top = Math.max(8, Math.min(top, window.innerHeight - popupHeight - 8)) + 'px';
    popup.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 268)) + 'px';
  }

  function renderCalendar(data) {
    if (!popup) return;
    viewYear = data.year;
    viewMonth = data.month;

    var weekDays = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
    var selected = parseInputDate(activeInput);

    var html = '';
    html += '<div class="jalali-cal-header">';
    html += '<button type="button" class="jalali-cal-nav" data-dir="prev">◀</button>';
    html += '<span class="jalali-cal-title">' + data.monthName + ' ' + data.year + '</span>';
    html += '<button type="button" class="jalali-cal-nav" data-dir="next">▶</button>';
    html += '</div>';
    html += '<div class="jalali-cal-grid jalali-cal-weekdays">';
    weekDays.forEach(function (wd) {
      html += '<span class="jalali-cal-weekday">' + wd + '</span>';
    });
    html += '</div>';
    html += '<div class="jalali-cal-grid jalali-cal-days">';
    for (var i = 0; i < data.startWeekday; i++) {
      html += '<span class="jalali-cal-day jalali-cal-empty"></span>';
    }
    for (var d = 1; d <= data.daysInMonth; d++) {
      var isToday = data.today.y === data.year && data.today.m === data.month && data.today.d === d;
      var isSelected = selected && selected.y === data.year && selected.m === data.month && selected.d === d;
      var cls = 'jalali-cal-day';
      if (isToday) cls += ' jalali-cal-today';
      if (isSelected) cls += ' jalali-cal-selected';
      html += '<button type="button" class="' + cls + '" data-day="' + d + '">' + d + '</button>';
    }
    html += '</div>';
    html += '<div class="jalali-cal-footer">';
    html += '<button type="button" class="jalali-cal-today-link" data-goto-today="1">امروز</button>';
    html += '</div>';

    popup.innerHTML = html;
    positionPopup();
  }

  function loadMonth(y, m) {
    fetch('/api/jalali-calendar?y=' + y + '&m=' + m)
      .then(function (res) { return res.json(); })
      .then(renderCalendar);
  }

  function openPopup(input) {
    if (activeInput === input && popup) return;
    closePopup();
    activeInput = input;
    popup = document.createElement('div');
    popup.className = 'jalali-cal-popup';
    popup.style.position = 'fixed';
    popup.style.top = '-9999px';
    document.body.appendChild(popup);

    var current = parseInputDate(input);
    if (current) {
      loadMonth(current.y, current.m);
    } else {
      loadMonth(null, null);
    }

    document.addEventListener('keydown', onKeyDown);
  }

  document.addEventListener('focusin', function (e) {
    if (e.target.matches && e.target.matches('.jalali-date-text')) {
      openPopup(e.target);
    }
  });

  document.addEventListener('click', function (e) {
    var input = e.target.closest('.jalali-date-text');
    if (input) {
      openPopup(input);
      return;
    }
    if (popup && !popup.contains(e.target)) {
      closePopup();
    }
  });

  document.addEventListener('click', function (e) {
    if (!popup) return;

    var navBtn = e.target.closest('.jalali-cal-nav');
    if (navBtn) {
      var dir = navBtn.dataset.dir;
      var m = viewMonth + (dir === 'next' ? 1 : -1);
      var y = viewYear;
      if (m < 1) { m = 12; y -= 1; }
      if (m > 12) { m = 1; y += 1; }
      loadMonth(y, m);
      return;
    }

    var dayBtn = e.target.closest('.jalali-cal-day:not(.jalali-cal-empty)');
    if (dayBtn) {
      var day = parseInt(dayBtn.dataset.day, 10);
      activeInput.value = viewYear + '/' + pad2(viewMonth) + '/' + pad2(day);
      activeInput.dispatchEvent(new Event('change', { bubbles: true }));
      closePopup();
      return;
    }

    var todayLink = e.target.closest('[data-goto-today]');
    if (todayLink) {
      fetch('/api/jalali-calendar')
        .then(function (res) { return res.json(); })
        .then(function (data) {
          activeInput.value = data.today.y + '/' + pad2(data.today.m) + '/' + pad2(data.today.d);
          activeInput.dispatchEvent(new Event('change', { bubbles: true }));
          closePopup();
        });
    }
  });

  window.addEventListener('resize', positionPopup);
  window.addEventListener('scroll', positionPopup, true);
})();
