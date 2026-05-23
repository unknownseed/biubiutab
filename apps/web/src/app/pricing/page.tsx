'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function PricingPage() {
  const [planSelection, setPlanSelection] = useState<'monthly' | 'quarterly' | 'yearly'>('quarterly');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get('success')) {
      setMessage('支付成功！您的账户已升级为 Pro，尽情享受吧。');
      
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
    if (query.get('canceled')) {
      setMessage('支付已取消。如果你遇到了问题，可以随时联系我们。');
      
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  const handleCheckout = async (billingMode: 'subscription' | 'one-time') => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          plan: planSelection,
          billingMode: billingMode 
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = '/login?next=/pricing';
        } else {
          alert(`支付初始化失败: ${data.error}`);
        }
        return;
      }
      
      window.location.href = data.url;
    } catch (err) {
      console.error(err);
      alert('网络请求失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const featuresFree = [
    '每月 3 次 AI 制谱（限时 90 秒）',
    '访问基础教学模块（预习、基础）',
    '在线播放器跟弹练习',
    '社区基础支持'
  ];

  const featuresPro = [
    '每月 100 次 AI 制谱（无时长限制）',
    '免排队，专享高优先级计算节点',
    '解锁进阶教学模块（高级、Solo）',
    '解锁高清演示视频 (Demo Video)',
    '支持下载原版 .gp5 源文件',
    '保留所有云端历史曲谱'
  ];

  return (
    <main className="min-h-screen bg-paper-100 pt-32 pb-24 selection:bg-retro-green/20">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <span className="text-sm font-bold tracking-[0.3em] text-wood-500 uppercase border-b-2 border-wood-500 pb-1">
            价格
          </span>
          <h1 className="text-5xl md:text-6xl font-serif text-ink-950 mt-8 mb-6 leading-tight tracking-wide">
            选择适合你的节奏
          </h1>
          <p className="text-ink-800 text-lg font-medium tracking-wider mb-8">
            从初学者的第一次拨弦，到创作者的灵感记录。<br className="hidden sm:block" />
            无论你处于哪个阶段，这里都有适合你的方案。
          </p>
          <div className="flex flex-col items-center justify-center mb-8">
            <p className="text-sm text-ink-800 font-medium tracking-widest mb-4">支持安全便捷的支付方式</p>
            <div className="flex justify-center items-center gap-6 transition-all duration-500">
              <div className="flex items-center gap-1.5 text-[#1677FF]">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.695 15.07c3.426 1.158 4.203 1.22 4.203 1.22V3.846c0-2.124-1.705-3.845-3.81-3.845H3.914C1.808.001.102 1.722.102 3.846v16.31c0 2.123 1.706 3.845 3.813 3.845h16.173c2.105 0 3.81-1.722 3.81-3.845v-.157s-6.19-2.602-9.315-4.119c-2.096 2.602-4.8 4.181-7.607 4.181-4.75 0-6.361-4.19-4.112-6.949.49-.602 1.324-1.175 2.617-1.497 2.025-.502 5.247.313 8.266 1.317a16.796 16.796 0 0 0 1.341-3.302H5.781v-.952h4.799V6.975H4.77v-.953h5.81V3.591s0-.409.411-.409h2.347v2.84h5.744v.951h-5.744v1.704h4.69a19.453 19.453 0 0 1-1.986 5.06c1.424.52 2.702 1.011 3.654 1.333m-13.81-2.032c-.596.06-1.71.325-2.321.869-1.83 1.608-.735 4.55 2.968 4.55 2.151 0 4.301-1.388 5.99-3.61-2.403-1.182-4.438-2.028-6.637-1.809"/>
                </svg>
                <span className="text-sm font-bold font-sans tracking-wider">支付宝 Alipay</span>
              </div>
              <div className="w-px h-4 bg-ink-900/10"></div>
              <div className="flex items-center gap-1.5">
                <img 
                  src="/stripe-logo.svg" 
                  alt="Stripe" 
                  className="h-6 object-contain"
                />
              </div>
            </div>
          </div>
          
          {message && (
            <div className={`mt-4 px-4 py-3 rounded-md text-sm font-medium tracking-widest inline-block ${
              message.includes('成功') ? 'bg-retro-green/10 text-retro-green border border-retro-green/20' : 'bg-red-50 text-red-600 border border-red-100'
            }`}>
              {message}
            </div>
          )}
        </div>

        <div className="flex justify-center mb-16 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
          <div className="bg-paper-200/50 p-1.5 border border-wood-400/20 inline-flex items-center rounded-lg">
            <button
              onClick={() => setPlanSelection('monthly')}
              className={`px-6 py-2.5 text-sm font-medium tracking-widest transition-all duration-300 rounded-md ${
                planSelection === 'monthly'
                  ? 'bg-white shadow-sm text-ink-900 border border-wood-400/10' 
                  : 'text-ink-700/60 hover:text-ink-900'
              }`}
            >
              1 个月
            </button>
            <button
              onClick={() => setPlanSelection('quarterly')}
              className={`px-6 py-2.5 text-sm font-medium tracking-widest transition-all duration-300 flex items-center gap-2 rounded-md ${
                planSelection === 'quarterly'
                  ? 'bg-retro-green text-paper-50 shadow-sm' 
                  : 'text-ink-700/60 hover:text-ink-900'
              }`}
            >
              3 个月
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${planSelection === 'quarterly' ? 'bg-paper-50/20 text-paper-50' : 'bg-retro-green/10 text-retro-green'}`}>
                热卖
              </span>
            </button>
            <button
              onClick={() => setPlanSelection('yearly')}
              className={`px-6 py-2.5 text-sm font-medium tracking-widest transition-all duration-300 flex items-center gap-2 rounded-md ${
                planSelection === 'yearly'
                  ? 'bg-retro-green text-paper-50 shadow-sm' 
                  : 'text-ink-700/60 hover:text-ink-900'
              }`}
            >
              1 年
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${planSelection === 'yearly' ? 'bg-paper-50/20 text-paper-50' : 'bg-retro-green/10 text-retro-green'}`}>
                省 40%
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
          <div className="bg-paper-50 border border-wood-400/20 p-8 lg:p-12 flex flex-col h-full hover:border-wood-400/40 transition-colors duration-500">
            <h2 className="text-3xl font-serif text-ink-950 mb-2">体验版</h2>
            <p className="text-ink-800 text-base tracking-widest mb-8 h-10 font-medium">
              适合想要简单体验 AI 制谱与基础练习的初学者。
            </p>
            <div className="mb-8">
              <span className="text-5xl font-serif text-ink-950">￥0</span>
              <span className="text-ink-800 ml-2 font-medium">/ 永远</span>
            </div>
            
            <Link 
              href="/login" 
              className="w-full block text-center border-2 border-ink-900 text-ink-950 py-4 font-bold tracking-widest hover:bg-ink-900 hover:text-paper-50 transition-colors duration-500 mb-10"
            >
              免费开始
            </Link>

            <div className="space-y-4 flex-1">
              <p className="text-sm font-bold tracking-widest text-ink-900 uppercase mb-6">包含以下权益：</p>
              {featuresFree.map((feat, i) => (
                <div key={i} className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-wood-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-base font-medium text-ink-900 leading-relaxed tracking-wide">{feat}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-retro-green relative p-8 lg:p-12 flex flex-col h-full shadow-2xl">
            <div className="absolute inset-0 border border-paper-50/10 m-2 pointer-events-none" />
            
            <div className="absolute top-0 right-8 transform -translate-y-1/2">
              <span className="bg-wood-400 text-ink-950 text-sm font-bold tracking-widest px-4 py-1.5 uppercase shadow-sm">
                强烈推荐
              </span>
            </div>

            <h2 className="text-3xl font-serif text-paper-50 mb-2">BiuBiu Pro</h2>
            <p className="text-paper-50/90 text-base font-medium tracking-widest mb-8 h-10">
              为进阶乐手与创作者打造，解锁无限制的音乐潜力。
            </p>
            
            <div className="mb-8 flex items-end gap-2">
              <span className="text-5xl font-serif text-paper-50">
                ￥{planSelection === 'yearly' ? '199' : planSelection === 'quarterly' ? '69' : '29'}
              </span>
              <span className="text-paper-50/80 mb-1 font-medium">
                / {planSelection === 'yearly' ? '年' : planSelection === 'quarterly' ? '季' : '月'}
              </span>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 mb-10 relative z-10">
              <button 
                onClick={() => handleCheckout('subscription')}
                disabled={isLoading}
                className="flex-1 bg-paper-50 text-retro-green py-3.5 font-bold tracking-widest hover:bg-wood-400 hover:text-ink-950 transition-colors duration-500 shadow-md disabled:opacity-50 text-sm"
              >
                {isLoading ? '加载中...' : '自动续订 (信用卡)'}
              </button>
              
              <button 
                onClick={() => handleCheckout('one-time')}
                disabled={isLoading}
                className="flex-1 border-2 border-paper-50/60 text-paper-50 py-3.5 font-bold tracking-widest hover:bg-paper-50 hover:text-retro-green transition-colors duration-500 shadow-sm disabled:opacity-50 text-sm"
              >
                {isLoading ? '加载中...' : '单次充值 (含支付宝)'}
              </button>
            </div>

            <div className="space-y-4 flex-1 relative z-10">
              <p className="text-sm font-bold tracking-widest text-paper-50 uppercase mb-6">包含体验版所有功能，以及：</p>
              {featuresPro.map((feat, i) => (
                <div key={i} className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-wood-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-base font-medium text-paper-50 leading-relaxed tracking-wide">{feat}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        <div className="mt-20 text-center animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
          <p className="text-sm text-ink-800 tracking-widest font-medium mb-6">如有任何支付问题，请随时联系我们获得支持</p>
        </div>

        <div className="mt-12 p-8 rounded-2xl border border-retro-green/20 bg-retro-green/5 max-w-2xl mx-auto text-center animate-in fade-in slide-in-from-bottom-8 duration-700 delay-400">
          <h3 className="font-serif text-xl text-ink-900 tracking-wide mb-3">还有桌面版？</h3>
          <p className="text-sm text-ink-700/70 leading-relaxed mb-5">
            BiuBiu Tab 桌面客户端提供原生体验：本地 AI 处理更快、离线练习不受网络限制、海量教学随时触达。
            <br />Pro 会员在桌面端可直接解锁全部功能。
          </p>
          <Link
            href="/download"
            className="inline-flex items-center justify-center rounded-lg bg-retro-green px-8 py-3 text-sm tracking-widest text-paper-50 font-serif hover:bg-retro-green/90 transition-colors"
          >
            免费下载桌面版
          </Link>
        </div>

      </div>
    </main>
  );
}
