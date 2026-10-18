import React from 'react';

interface State {
  error: Error | null;
}

// اگر هر صفحه در رندر خطا بدهد، به‌جای سفید شدن کل برنامه یک پیام با جزئیات خطا نشان می‌دهد
export class ErrorBoundary extends React.Component<{ children: React.ReactNode; resetKey?: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('UI error:', error, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    // با عوض شدن صفحه (تب)، خطا پاک می‌شود
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="p-8 max-w-2xl mx-auto mt-10 rounded-2xl bg-slate-900 border border-rose-500/40 text-slate-200 space-y-3" role="alert">
        <h2 className="text-base font-bold text-rose-300">خطایی در نمایش این صفحه رخ داد</h2>
        <p className="text-xs text-slate-400">اطلاعات شما سالم است؛ فقط نمایش این بخش با مشکل روبه‌رو شد. می‌توانید دوباره تلاش کنید یا صفحه را تازه کنید. اگر تکرار شد، متن زیر را برای پشتیبانی بفرستید:</p>
        <pre dir="ltr" className="text-[11px] text-left bg-slate-950 border border-slate-800 rounded-xl p-3 overflow-auto max-h-48 whitespace-pre-wrap">{String(this.state.error.stack || this.state.error.message).slice(0, 1200)}</pre>
        <div className="flex gap-2">
          <button onClick={() => this.setState({ error: null })} className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 border border-slate-700 hover:bg-slate-700">تلاش دوباره</button>
          <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white">تازه‌سازی صفحه</button>
        </div>
      </div>
    );
  }
}
