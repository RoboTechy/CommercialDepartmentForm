document.addEventListener('click', function (e) {
  var btn = e.target.closest('.today-btn');
  if (!btn) return;
  var wrapper = btn.closest('.jalali-date-input');
  var input = wrapper && wrapper.querySelector('input');
  if (input) input.value = btn.dataset.today;
});

// --- هشدار (نه جلوگیری) هنگام تکراری بودن شماره درخواست کالا/خرید ---
// قبل از ارسال فرم، از سرور می‌پرسیم آیا این شماره قبلاً هم ثبت شده؛ اگر
// بله، با confirm() به کاربر نشان می‌دهیم در چه ردیف‌هایی تکرار شده و خودش
// تصمیم می‌گیرد که آیا همین‌طور ثبت را ادامه بدهد یا نه.
(function () {
  function describeMatches(rows) {
    return rows
      .map(function (r) {
        return (
          '#' + r.id + ' (شماره درخواست کالا: ' + (r.requestNo || '—') +
          '، شماره درخواست خرید: ' + (r.purchaseRequestNo || '—') + ')'
        );
      })
      .join('\n');
  }

  function attachDuplicateGuard(form, fieldName, apiPath, extraQuery) {
    var input = form.querySelector('[name="' + fieldName + '"]');
    if (!input) return;
    var lastCheckedValue = null;
    var lastCheckedOk = false;

    form.addEventListener('submit', function (e) {
      var value = (input.value || '').trim();
      if (!value || (lastCheckedOk && value === lastCheckedValue)) return;

      e.preventDefault();
      var url = apiPath + '?value=' + encodeURIComponent(value) + (extraQuery ? '&' + extraQuery : '');
      fetch(url)
        .then(function (res) { return res.json(); })
        .then(function (data) {
          var rows = data.rows || [];
          lastCheckedValue = value;
          if (!rows.length) {
            lastCheckedOk = true;
            form.submit();
            return;
          }
          var msg =
            'این شماره قبلاً در ردیف(های) زیر ثبت شده است:\n' + describeMatches(rows) +
            '\n\nآیا مطمئن هستید می‌خواهید همین‌طور ثبت را انجام دهید؟';
          lastCheckedOk = window.confirm(msg);
          if (lastCheckedOk) form.submit();
        })
        .catch(function () {
          // اگر چک سمت سرور به هر دلیلی شکست خورد، مانع ثبت نمی‌شویم
          lastCheckedOk = true;
          form.submit();
        });
    });
  }

  var newRowForm = document.querySelector('form[action="/rows"]');
  if (newRowForm) {
    attachDuplicateGuard(newRowForm, 'request_no', '/api/check-request-no');
  }

  document.querySelectorAll('form[data-section-key="warehouse_1"]').forEach(function (form) {
    attachDuplicateGuard(
      form,
      'purchase_request_no',
      '/api/check-purchase-request-no',
      'excludeId=' + encodeURIComponent(form.dataset.rowId)
    );
  });
})();

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
    if (e.target.matches && e.target.matches('.jalali-date-text:not([readonly]):not([disabled])')) {
      openPopup(e.target);
    }
  });

  document.addEventListener('click', function (e) {
    var input = e.target.closest('.jalali-date-text:not([readonly]):not([disabled])');
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

// --- ویرایش درجا (inline) یک فیلد از روی فهرست اصلی - با دابل‌کلیک روی هر
// سلولی که کاربر اجازه‌ی ویرایشش را دارد (سرور از قبل مشخص کرده کدام
// سلول‌ها؛ به td.cell-editable نگاه کنید) ---
(function () {
  function renderCellValue(td, text) {
    td.innerHTML = '';
    var span = document.createElement('span');
    span.className = 'cell-value';
    span.textContent = text || '-';
    td.appendChild(span);
  }

  function saveInlineEdit(td, newValue, oldValue, oldDisplayText) {
    newValue = (newValue || '').trim();
    if (newValue === (oldValue || '').trim()) {
      renderCellValue(td, oldDisplayText);
      return;
    }

    function doSave() {
      fetch('/rows/' + td.dataset.rowId + '/fields/' + td.dataset.field, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'value=' + encodeURIComponent(newValue),
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.ok) {
            renderCellValue(td, data.value);
            if (window.PRT_invalidateHistoryCache) window.PRT_invalidateHistoryCache(td.dataset.rowId, td.dataset.field);
          } else {
            alert(data.error || 'ثبت تغییر ناموفق بود.');
            renderCellValue(td, oldDisplayText);
          }
        })
        .catch(function () {
          alert('خطا در برقراری ارتباط با سرور. تغییر ثبت نشد.');
          renderCellValue(td, oldDisplayText);
        });
    }

    if (td.dataset.field === 'purchase_request_no' && newValue) {
      fetch('/api/check-purchase-request-no?value=' + encodeURIComponent(newValue) + '&excludeId=' + encodeURIComponent(td.dataset.rowId))
        .then(function (res) { return res.json(); })
        .then(function (data) {
          var matches = data.rows || [];
          if (!matches.length) return doSave();
          var msg =
            'این شماره قبلاً در ردیف(های) زیر ثبت شده است:\n' +
            matches.map(function (r) { return '#' + r.id + ' (شماره درخواست کالا: ' + (r.requestNo || '—') + ')'; }).join('\n') +
            '\n\nآیا مطمئن هستید می‌خواهید همین‌طور ثبت کنید؟';
          if (window.confirm(msg)) doSave();
          else renderCellValue(td, oldDisplayText);
        })
        .catch(doSave);
    } else {
      doSave();
    }
  }

  function startInlineEdit(td) {
    if (td.querySelector('.inline-edit-input')) return;
    var valueSpan = td.querySelector('.cell-value');
    var oldDisplayText = valueSpan ? valueSpan.textContent : td.textContent.trim();
    var oldValue = oldDisplayText === '-' ? '' : oldDisplayText;
    var fieldType = td.dataset.type;
    var input;

    if (fieldType === 'select') {
      input = document.createElement('select');
      var emptyOpt = document.createElement('option');
      emptyOpt.value = '';
      emptyOpt.textContent = '— انتخاب کنید —';
      input.appendChild(emptyOpt);
      (td.dataset.options ? td.dataset.options.split('|') : []).forEach(function (opt) {
        var o = document.createElement('option');
        o.value = opt;
        o.textContent = opt;
        if (opt === oldValue) o.selected = true;
        input.appendChild(o);
      });
    } else {
      input = document.createElement('input');
      input.type = 'text';
      if (fieldType === 'jalali-date') input.classList.add('jalali-date-text');
      input.value = oldValue;
    }
    input.className += ' inline-edit-input';

    td.innerHTML = '';
    td.appendChild(input);
    input.focus();
    if (input.select) input.select();

    var finished = false;
    function finish(save) {
      if (finished) return;
      finished = true;
      if (save) saveInlineEdit(td, input.value, oldValue, oldDisplayText);
      else renderCellValue(td, oldDisplayText);
    }

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
    if (fieldType === 'select' || fieldType === 'jalali-date') {
      input.addEventListener('change', function () { finish(true); });
    }
    input.addEventListener('blur', function () {
      setTimeout(function () {
        if (finished) return;
        // اگر تقویم شمسی هنوز باز است، صبر می‌کنیم (رویداد change خودش کار را تمام می‌کند)
        if (fieldType === 'jalali-date' && document.querySelector('.jalali-cal-popup')) return;
        finish(true);
      }, 200);
    });
  }

  document.addEventListener('dblclick', function (e) {
    var td = e.target.closest('td.cell-editable');
    if (td) startInlineEdit(td);
  });
})();

// --- باکس تاریخچه روی یک سلول از فهرست اصلی (به‌جز شماره درخواست کالا/خرید
// و فیلدهای فقط‌خواندنی) - نشان می‌دهد چه کسی، چه زمانی، از چه مقداری به چه
// مقداری این فیلد را تغییر داده؛ محل نمایش باکس (چپ/راست/بالا/پایین) بر
// اساس فضای خالی اطراف سلول خودکار تعیین می‌شود. روی دستگاه‌های با موس
// (دسکتاپ) با هاور باز می‌شود؛ روی لمسی (موبایل/تبلت) با یک تب باز/بسته
// می‌شود - دابل‌تب هم‌چنان مخصوص ویرایش سریع می‌ماند (mousedown/dblclick
// جدا از این بخش است) ---
(function () {
  var popup = null;
  var currentCell = null;
  var showTimer = null;
  var hideTimer = null;
  var cache = {};
  var supportsHover = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // اگر بعد از ویرایش درجای یک فیلد، کاربر دوباره همان سلول را هاور/تب کند،
  // نباید تاریخچه‌ی قدیمیِ کش‌شده (بدون آخرین تغییر) نشان داده شود
  window.PRT_invalidateHistoryCache = function (rowId, field) {
    delete cache[rowId + ':' + field];
  };

  function closePopup() {
    if (popup) {
      popup.remove();
      popup = null;
    }
    currentCell = null;
  }

  function escapeHtml(s) {
    var div = document.createElement('div');
    div.textContent = s == null ? '' : String(s);
    return div.innerHTML;
  }

  function formatEntry(e) {
    var oldV = e.oldValue ? escapeHtml(e.oldValue) : '<span class="hist-empty-val">—</span>';
    var newV = e.newValue ? escapeHtml(e.newValue) : '<span class="hist-empty-val">—</span>';
    return (
      '<div class="hist-entry">' +
      '<div class="hist-meta">' + escapeHtml(e.changedByDisplay) + ' · ' + escapeHtml(e.changedAt) + '</div>' +
      '<div class="hist-change">' + oldV + '<span class="hist-arrow">→</span>' + newV + '</div>' +
      '</div>'
    );
  }

  function positionPopup(cell) {
    if (!popup) return;
    var rect = cell.getBoundingClientRect();
    var pw = popup.offsetWidth;
    var ph = popup.offsetHeight;
    var margin = 10;
    var spaceRight = window.innerWidth - rect.right;
    var spaceLeft = rect.left;

    // اول سعی می‌کند کنار سلول (چپ یا راست، هرکدام فضای بیشتری دارد) جا شود
    var left;
    if (spaceLeft >= pw + margin || spaceLeft >= spaceRight) {
      left = rect.left - pw - margin;
    } else {
      left = rect.right + margin;
    }
    left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));

    var top = rect.top;
    if (top + ph > window.innerHeight - 8) {
      top = rect.bottom - ph;
    }
    top = Math.max(8, Math.min(top, window.innerHeight - ph - 8));

    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
  }

  function renderPopup(cell, entries) {
    if (currentCell !== cell) return;
    // توجه: عمداً closePopup() صدا زده نمی‌شود، چون آن تابع currentCell را هم
    // null می‌کند و باعث می‌شود بعد از رندر شدن، حالت "سلول جاری باز است"
    // گم شود (و مثلاً تب دوم روی موبایل به‌جای بستن، دوباره باز کند)
    if (popup) {
      popup.remove();
      popup = null;
    }
    popup = document.createElement('div');
    popup.className = 'cell-history-popup';
    var html = '<div class="hist-title">' + escapeHtml(cell.dataset.fieldLabel) + '</div>';
    if (!entries.length) {
      html += '<div class="hist-empty">هنوز تغییری روی این فیلد ثبت نشده است.</div>';
    } else {
      html += entries.map(formatEntry).join('');
    }
    if (cell.classList.contains('cell-editable')) {
      html += '<div class="hist-hint">برای ویرایش سریع، روی سلول دابل‌کلیک کنید</div>';
    }
    popup.innerHTML = html;
    document.body.appendChild(popup);
    positionPopup(cell);
  }

  function loadHistory(cell) {
    var key = cell.dataset.rowId + ':' + cell.dataset.field;
    if (cache[key]) {
      renderPopup(cell, cache[key]);
      return;
    }
    fetch('/rows/' + cell.dataset.rowId + '/fields/' + cell.dataset.field + '/history')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        cache[key] = data.entries || [];
        renderPopup(cell, cache[key]);
      })
      .catch(function () {});
  }

  if (supportsHover) {
    document.addEventListener('mouseover', function (e) {
      if (popup && popup.contains(e.target)) {
        clearTimeout(hideTimer);
        return;
      }
      var cell = e.target.closest('td.has-history');
      if (!cell || cell === currentCell) return;
      clearTimeout(hideTimer);
      clearTimeout(showTimer);
      currentCell = cell;
      showTimer = setTimeout(function () {
        if (currentCell === cell) loadHistory(cell);
      }, 300);
    });

    document.addEventListener('mouseout', function (e) {
      var leavingCell = e.target.closest('td.has-history');
      var leavingPopup = popup && popup.contains(e.target);
      if (!leavingCell && !leavingPopup) return;
      var related = e.relatedTarget;
      if (related && (related.closest && (related.closest('td.has-history') === currentCell || (popup && popup.contains(related))))) {
        return;
      }
      clearTimeout(showTimer);
      hideTimer = setTimeout(closePopup, 150);
    });
  } else {
    // دستگاه لمسی: یک تب باز/بسته می‌کند (دابل‌تب هم‌چنان برای ویرایش سریع
    // آزاد می‌ماند، چون اینجا با click کار می‌کنیم نه dblclick)
    document.addEventListener('click', function (e) {
      if (popup && popup.contains(e.target)) return;
      var cell = e.target.closest('td.has-history');
      if (!cell) {
        closePopup();
        return;
      }
      if (cell === currentCell && popup) {
        closePopup();
        return;
      }
      currentCell = cell;
      loadHistory(cell);
    });
  }

  var scrollHost = document.getElementById('rows-table-scroll');
  if (scrollHost) scrollHost.addEventListener('scroll', closePopup);
  // چون این باکس position:fixed است، اگر کل صفحه اسکرول شود (نه فقط خود
  // جدول)، موقعیتش دیگر با سلول واقعی هماهنگ نمی‌ماند - پس بسته می‌شود
  window.addEventListener('scroll', closePopup, true);
  window.addEventListener('resize', closePopup);
})();

// --- آکاردئون بخش‌های صفحه‌ی جزئیات ردیف - فقط باز/بسته کردن نمایشی؛ هیچ
// بخشی غیرقابل‌کلیک نیست (مجوز/قفل واقعی هر بخش هم‌چنان سمت سرور و در
// خود section.canEdit تعیین می‌شود، این فقط UI باز/بسته‌شدن است) ---
(function () {
  var accordion = document.getElementById('row-accordion');
  if (!accordion) return;

  accordion.querySelectorAll('.acc-item').forEach(function (item) {
    var head = item.querySelector('.acc-head');
    head.addEventListener('click', function () {
      var wasOpen = item.classList.contains('open');
      accordion.querySelectorAll('.acc-item.open').forEach(function (other) {
        if (other !== item) other.classList.remove('open');
      });
      item.classList.toggle('open', !wasOpen);
    });
  });

  // کلیک روی یک نقطه‌ی نوار مراحل، همان بخش را در آکاردئون باز و به آن اسکرول می‌کند
  var steps = document.querySelectorAll('.stepper .step');
  var items = accordion.querySelectorAll('.acc-item');
  steps.forEach(function (step, idx) {
    step.style.cursor = 'pointer';
    step.addEventListener('click', function () {
      var item = items[idx];
      if (!item) return;
      accordion.querySelectorAll('.acc-item.open').forEach(function (other) {
        if (other !== item) other.classList.remove('open');
      });
      item.classList.add('open');
      item.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
})();

// --- بازرگانی غدیر: اگر مجری خرید «تهران» یا «برنا» باشد، بازرگانی سایت
// مجوز پرداخت صادر نمی‌کند، پس «تاریخ صدور مجوز پرداخت» غیرفعال می‌شود -
// وضعیت اولیه (صفحه بارگذاری‌شده) را خود سرور رندر کرده (به
// isPaymentAuthWaived در src/sections.js مراجعه کنید)؛ این بخش فقط برای
// وقتی است که کاربر بدون رفرش صفحه مقدار «مجری خرید» را عوض می‌کند - باید
// همان دو مقدار دقیقاً با sections.js هماهنگ بماند ---
(function () {
  var EXTERNAL_PURCHASE_EXECUTORS = ['تهران', 'برنا'];
  document.querySelectorAll('form[data-section-key="commercial"]').forEach(function (form) {
    var executorSelect = form.querySelector('[name="purchase_executor"]');
    var paymentInput = form.querySelector('[name="payment_auth_issued_date"]');
    var todayBtn = paymentInput && paymentInput.closest('.jalali-date-input').querySelector('.today-btn');
    if (!executorSelect || !paymentInput) return;

    executorSelect.addEventListener('change', function () {
      var waived = EXTERNAL_PURCHASE_EXECUTORS.indexOf(executorSelect.value) !== -1;
      paymentInput.readOnly = waived;
      paymentInput.classList.toggle('is-waived', waived);
      if (todayBtn) todayBtn.disabled = waived;
    });
  });
})();

// --- دکمه‌های «فقط ستون‌های خودم را نشان بده» بالای فهرست اصلی - فقط
// چه ستون‌هایی از همان جدول دیده می‌شوند را (با CSS) کنترل می‌کند، به
// فیلتر واقعی/داده‌ی سرور کاری ندارد. انتخاب کاربر در localStorage
// نگه داشته می‌شود تا دفعه‌ی بعد هم یادش بماند؛ اگر چیزی ذخیره نشده
// باشد، پیش‌فرض هوشمند سمت سرور (دپارتمان خود کاربر) استفاده می‌شود ---
(function () {
  var toggle = document.getElementById('column-group-toggle');
  var table = document.querySelector('.sheet-table');
  if (!toggle || !table) return;
  var STORAGE_KEY = 'prt-dashboard-column-group';
  var GROUP_COLORS = ['tech_operator', 'warehouse', 'commercial'];

  function applyGroup(group) {
    GROUP_COLORS.forEach(function (c) { table.classList.remove('group-' + c); });
    if (group) table.classList.add('group-' + group);
    toggle.querySelectorAll('.group-toggle-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.group === group);
    });
  }

  toggle.querySelectorAll('.group-toggle-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var group = btn.dataset.group;
      applyGroup(group);
      try { localStorage.setItem(STORAGE_KEY, group); } catch (e) {}
    });
  });

  var saved = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}
  applyGroup(saved !== null ? saved : toggle.dataset.defaultGroup || '');
})();

// --- نمودارهای میله‌ای صفحه‌ی گزارش‌های مدیریتی - لایه‌ی هاور/فوکوس: مقدار
// همیشه کنار خود میله هم دیده می‌شود (تولتیپ چیزی را قایم نمی‌کند)، اینجا
// فقط جزئیات بیشتر (میانه/حداقل/حداکثر/تعداد) روی هاور یا فوکوس کیبورد
// نمایش داده می‌شود. مقادیر از data-* با textContent درج می‌شوند (نه
// innerHTML) چون این‌ها می‌توانند از دادهٔ ردیف‌ها بیایند ---
(function () {
  var tooltip = document.getElementById('chart-tooltip');
  var bars = document.querySelectorAll('.bar-fill[data-value]');
  if (!tooltip || !bars.length) return;
  var ttLabel = tooltip.querySelector('.tt-label');
  var ttValue = tooltip.querySelector('.tt-value');
  var ttDetail = tooltip.querySelector('.tt-detail');

  function showFor(bar, x, y) {
    ttLabel.textContent = bar.dataset.label || '';
    ttValue.textContent = bar.dataset.value || '';
    ttDetail.textContent = bar.dataset.detail || '';
    tooltip.hidden = false;
    positionAt(x, y);
  }

  function positionAt(x, y) {
    var pad = 14;
    var rect = tooltip.getBoundingClientRect();
    var left = x + pad;
    if (left + rect.width > window.innerWidth - pad) left = x - rect.width - pad;
    var top = y - rect.height - pad;
    if (top < pad) top = y + pad;
    tooltip.style.left = Math.max(pad, left) + 'px';
    tooltip.style.top = Math.max(pad, top) + 'px';
  }

  function hide() { tooltip.hidden = true; }

  bars.forEach(function (bar) {
    bar.addEventListener('pointerenter', function (e) { showFor(bar, e.clientX, e.clientY); });
    bar.addEventListener('pointermove', function (e) { if (!tooltip.hidden) positionAt(e.clientX, e.clientY); });
    bar.addEventListener('pointerleave', hide);
    bar.addEventListener('focus', function () {
      var r = bar.getBoundingClientRect();
      showFor(bar, r.left + r.width / 2, r.top);
    });
    bar.addEventListener('blur', hide);
  });
})();

// --- هدر شناور جدول اصلی - چون sticky واقعی روی هدر جدول به‌خاطر
// overflow-x:auto روی .table-scroll (که overflow-y را هم اجباراً auto
// می‌کند) فقط نسبت به همان جدول می‌چسبد نه کل صفحه (به کامنت بالای
// .table-scroll در style.css مراجعه کنید)، اینجا یک کپی تصویری از دو
// ردیف اول هدر واقعی (عنوان گروه‌ها + عنوان فیلدها) در یک نوار
// position:fixed ساخته می‌شود که فقط وقتی هدر واقعی از بالای صفحه رد شده
// نمایش داده می‌شود. ردیف سوم هدر (فیلترها) عمداً کپی نمی‌شود چون
// input/select واقعی دارد و کپی‌اش باعث ارسال دوباره‌ی همان name در فرم
// فیلتر می‌شود ---
(function () {
  var tableScroll = document.getElementById('rows-table-scroll');
  var table = tableScroll && tableScroll.querySelector('table.sheet-table');
  var topbar = document.querySelector('.topbar');
  if (!tableScroll || !table) return;

  var realRows = table.querySelectorAll('thead tr');
  if (realRows.length < 2) return;
  var realTitleRows = [realRows[0], realRows[1]];

  // توجه: با table-layout:fixed، مرورگر عرض هر ستون را فقط از روی ردیف
  // اول جدول تعیین می‌کند - و چون ردیف اول همین‌جا colspan دارد (عنوان
  // گروه‌ها)، گذاشتن width روی تک‌تک <th>های ردیف دوم (عنوان فیلدها) هیچ
  // اثری ندارد (مرورگر عرض هر colspan را بین زیرستون‌هایش به‌طور مساوی
  // تقسیم می‌کند، نه طبق چیزی که ما خواستیم). راه‌حل درست طبق مشخصات CSS:
  // <colgroup><col style="width">... - این همیشه در اولویت است.
  // پیچیدگی اضافه: ستون‌های id/وضعیت/عملیات با rowspan در ردیف اول
  // هستند و اصلاً سلولی در ردیف دوم ندارند (چون ردیف دوم را هم اشغال
  // کرده‌اند)، پس شبکه‌ی واقعی ستون‌ها این‌طور است: هر سلول rowspan-دار در
  // ردیف اول خودش دقیقاً یک ستون شبکه است (عرضش از خودش اندازه‌گیری
  // می‌شود)، و هر سلول colspan-دار در ردیف اول (عنوان گروه، بدون rowspan)
  // N ستون شبکه است که عرض هرکدام را باید از N سلول متناظر در ردیف دوم
  // (به ترتیب) گرفت - دقیقاً همان چیزی که حلقه‌ی زیر می‌سازد
  // توجه مهم دیگر: کلاس group-X (که دکمه‌ی «فقط ستون‌های خودم» روی جدول
  // اصلی می‌گذارد و باعث می‌شود CSS با display:none چند ستون را پنهان
  // کند) را عمداً هیچ‌وقت روی جدول شناور نمی‌گذاریم - آزمایش مستقیم نشان
  // داد وقتی چند ستون پیاپی در ردیف دوم display:none دارند، کروم عرض
  // ستون‌های *بعد از* آن‌ها را به‌اشتباه صفر حساب می‌کند (حتی وقتی <col>
  // آن‌ها عرض درست دارد) - یک باگ/محدودیت واقعی در پیاده‌سازی
  // table-layout:fixed، نه چیزی که با تنظیمات دیگر رفع شود. چون عرض هر
  // ستون این‌جا از قبل با <col style="width:0"> صفر می‌شود، پنهان‌کردن
  // دوباره‌ی سلول‌ها با display:none اصلاً لازم نیست - همان عرض صفر کافی
  // است که آن ستون در شناور دیده نشود
  function baseTableClassName(cls) {
    return cls
      .split(/\s+/)
      .filter(function (c) { return c && !/^group-/.test(c); })
      .join(' ');
  }

  var shadow = document.createElement('div');
  shadow.className = 'shadow-header';
  var shadowTable = document.createElement('table');
  shadowTable.className = baseTableClassName(table.className);

  // ردیف‌ها را اول کلون می‌کنیم (قبل از ساخت colgroup) چون برای هر ستون
  // هم باید سلول واقعی (برای اندازه‌گیری عرض) و هم سلول کلون‌شده‌ی متناظر
  // در شناور (برای پنهان‌کردن محتوایش وقتی آن ستون صفر است) را کنار هم
  // نگه داریم - ایندکس فرزندان بین ردیف اصلی و کلونش دقیقاً یکی است
  var shadowThead = document.createElement('thead');
  var shadowRows = realTitleRows.map(function (row) {
    var clone = row.cloneNode(true);
    clone.querySelectorAll('[rowspan]').forEach(function (cell) {
      if (parseInt(cell.getAttribute('rowspan'), 10) > 2) cell.setAttribute('rowspan', '2');
    });
    shadowThead.appendChild(clone);
    return clone;
  });

  var colgroup = document.createElement('colgroup');
  var cols = []; // [{ col, measureFrom, shadowCell }]
  var sectionHeaders = []; // [{ shadowCell, entries }] - برای عنوان گروه‌ها (colspan)
  var row1Cells = realTitleRows[1].children;
  var shadowRow1Cells = shadowRows[1].children;
  var row1Idx = 0;
  Array.prototype.forEach.call(realTitleRows[0].children, function (cell, cellIdx) {
    var rowspan = parseInt(cell.getAttribute('rowspan') || '1', 10);
    var colspan = parseInt(cell.getAttribute('colspan') || '1', 10);
    var shadowHeaderCell = shadowRows[0].children[cellIdx];
    if (rowspan > 1) {
      var col = document.createElement('col');
      colgroup.appendChild(col);
      cols.push({ col: col, measureFrom: cell, shadowCell: shadowHeaderCell });
    } else {
      var entriesForThisHeader = [];
      for (var k = 0; k < colspan; k++) {
        var leafCell = row1Cells[row1Idx];
        var shadowLeafCell = shadowRow1Cells[row1Idx];
        row1Idx++;
        var col2 = document.createElement('col');
        colgroup.appendChild(col2);
        var entry = { col: col2, measureFrom: leafCell, shadowCell: shadowLeafCell, lastWidth: 0 };
        cols.push(entry);
        entriesForThisHeader.push(entry);
      }
      sectionHeaders.push({ shadowCell: shadowHeaderCell, entries: entriesForThisHeader });
    }
  });
  shadowTable.appendChild(colgroup);
  shadowTable.appendChild(shadowThead);
  shadow.appendChild(shadowTable);
  document.body.appendChild(shadow);

  function syncColumnWidths() {
    // با table-layout:fixed، اگر عرض خود جدول را صریحاً ندهیم، چون
    // شناور داخل .shadow-header با overflow:hidden است (که عرضش را برابر
    // دید فعلی/viewport جدول اصلی می‌گذاریم، نه کل جدول)، مرورگر عرض
    // ستون‌ها را متناسب با همان عرض کوچک‌تر از نو تقسیم می‌کند و همه‌ی
    // مقادیر <col> را نادیده می‌گیرد؛ باید عرض کل جدول را هم صریحاً برابر
    // مجموع عرض واقعی همه‌ی ستون‌ها بگذاریم تا اسکرول افقی داخل نوار
    // شناور معنا پیدا کند
    var total = 0;
    cols.forEach(function (entry) {
      var w = entry.measureFrom.getBoundingClientRect().width;
      entry.col.style.width = w + 'px';
      entry.lastWidth = w;
      // پنهان‌کردن محتوای سلول‌های ستون صفرعرض با visibility (نه
      // display:none) - چون display:none روی چند سلول پیاپی همان باگ
      // کروم بالا را دوباره برمی‌گرداند؛ visibility:hidden جای ستون را
      // در چیدمان دست‌نخورده نگه می‌دارد (که چون خودِ عرض ستون صفر است
      // اهمیتی ندارد) ولی متن سرریزشده‌ی nowrap را هم نامرئی می‌کند
      entry.shadowCell.style.visibility = w < 0.5 ? 'hidden' : '';
      total += w;
    });
    sectionHeaders.forEach(function (sh) {
      var allHidden = sh.entries.every(function (e) { return e.lastWidth < 0.5; });
      sh.shadowCell.style.visibility = allHidden ? 'hidden' : '';
    });
    shadowTable.style.width = total + 'px';
  }

  function positionShadow() {
    var rect = tableScroll.getBoundingClientRect();
    var topbarH = topbar ? topbar.getBoundingClientRect().height : 0;
    shadow.style.top = topbarH + 'px';
    shadow.style.left = rect.left + 'px';
    shadow.style.width = rect.width + 'px';
  }

  function syncScrollLeft() {
    shadow.scrollLeft = tableScroll.scrollLeft;
  }

  function updateVisibility() {
    var topbarH = topbar ? topbar.getBoundingClientRect().height : 0;
    var realTop = realTitleRows[0].getBoundingClientRect().top;
    shadow.classList.toggle('visible', realTop < topbarH);
  }

  function refreshAll() {
    syncColumnWidths();
    positionShadow();
    syncScrollLeft();
    updateVisibility();
  }

  var ticking = false;
  function onWindowScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      positionShadow();
      updateVisibility();
      ticking = false;
    });
  }

  tableScroll.addEventListener('scroll', syncScrollLeft);
  window.addEventListener('scroll', onWindowScroll, { passive: true });
  window.addEventListener('resize', refreshAll);

  // اگر دکمه‌ی «فقط ستون‌های خودم» (column-group-toggle) کلاس group-X را
  // روی جدول واقعی عوض کند، چند ستون واقعی display:none می‌شوند و بقیه
  // جا باز می‌کنند - عرض‌های ستون‌های شناور باید دوباره اندازه‌گیری شود
  // (کلاس group-X خودش هیچ‌وقت روی جدول شناور گذاشته نمی‌شود؛ به کامنت
  // بالای baseTableClassName مراجعه کنید). اندازه‌گیری را به دو
  // requestAnimationFrame بعد موکول می‌کنیم (نه بلافاصله داخل خود
  // callback): تجربه نشان داد اندازه‌گیری همان لحظه‌ی تغییر کلاس گاهی
  // هنوز عرض نهایی بعد از reflow را نشان نمی‌دهد
  var classObserver = new MutationObserver(function () {
    requestAnimationFrame(function () {
      requestAnimationFrame(refreshAll);
    });
  });
  classObserver.observe(table, { attributes: true, attributeFilter: ['class'] });

  refreshAll();
  // اندازه‌گیری مجدد بعد از لود کامل فونت وب (ممکن است عرض متن‌ها را کمی
  // جابه‌جا کند) - هم از طریق رویداد فونت، هم یک تلاش دیرهنگام برای اطمینان
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(refreshAll);
  }
  setTimeout(refreshAll, 300);
})();
