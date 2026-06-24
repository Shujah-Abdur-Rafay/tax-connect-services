import React, { useEffect, useRef, useState } from 'react';
import { Users, FileCheck2, Star, DollarSign, Clock, ShieldCheck } from 'lucide-react';

interface Stat {
  icon: typeof Users;
  value: number;
  suffix?: string;
  prefix?: string;
  label: string;
  color: string;
}

const stats: Stat[] = [
  { icon: FileCheck2, value: 47832, label: 'Returns filed this season', color: 'text-blue-600' },
  { icon: Users, value: 1284, label: 'Verified tax pros', color: 'text-emerald-600' },
  { icon: Star, value: 4.9, suffix: '/5', label: 'Average client rating', color: 'text-amber-500' },
  { icon: DollarSign, value: 312, prefix: '$', suffix: 'M', label: 'Refunds delivered', color: 'text-purple-600' },
  { icon: Clock, value: 1.2, suffix: ' hr', label: 'Average response time', color: 'text-indigo-600' },
  { icon: ShieldCheck, value: 99.7, suffix: '%', label: 'Accuracy guarantee', color: 'text-teal-600' },
];

const useCountUp = (target: number, duration = 1500, start = false) => {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf: number;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);
  return value;
};

const formatVal = (v: number, target: number) => {
  if (target < 10) return v.toFixed(1);
  if (target >= 10000) return Math.floor(v).toLocaleString();
  return Math.floor(v).toString();
};

const StatBlock: React.FC<{ stat: Stat; visible: boolean }> = ({ stat, visible }) => {
  const val = useCountUp(stat.value, 1600, visible);
  const Icon = stat.icon;
  return (
    <div className="group rounded-xl border bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
      <Icon className={`mb-2 h-6 w-6 ${stat.color}`} />
      <div className="text-3xl font-bold tracking-tight text-gray-900">
        {stat.prefix}{formatVal(val, stat.value)}{stat.suffix}
      </div>
      <p className="mt-1 text-sm text-gray-600">{stat.label}</p>
    </div>
  );
};

const SocialProofStats: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.25 }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={ref} className="bg-gradient-to-b from-gray-50 to-white py-16">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">Trusted by thousands</p>
          <h2 className="mt-2 text-3xl font-bold text-gray-900 md:text-4xl">A marketplace that delivers</h2>
          <p className="mx-auto mt-3 max-w-2xl text-gray-600">
            Real results from real clients filing real returns through Refund Connect this season.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {stats.map((s) => (
            <StatBlock key={s.label} stat={s} visible={visible} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default SocialProofStats;
