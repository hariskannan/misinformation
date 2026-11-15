import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '../context/ThemeContext';
import type { ActivityPoint, ModelPerformanceRow, RiskLevel } from '../types';

const RISK_COLORS: Record<string, string> = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444',
  unknown: '#94a3b8',
};

export function RiskDistributionChart({
  data,
}: {
  data: { risk_level: string; count: number; label?: string }[];
}) {
  const rows = data.map((row) => ({
    name: row.label ?? row.risk_level,
    value: row.count,
    color: RISK_COLORS[row.risk_level] ?? RISK_COLORS.unknown,
  }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={rows}
          dataKey="value"
          nameKey="name"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={3}
          strokeWidth={0}
        >
          {rows.map((row) => (
            <Cell key={row.name} fill={row.color} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ActivityChart({
  data,
}: {
  data: ActivityPoint[];
}) {
  const { theme } = useTheme();
  const gridColor = theme === 'dark' ? '#16304e' : '#e2e8f0';
  const textColor = theme === 'dark' ? '#94a3b8' : '#64748b';
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis dataKey="date" stroke={textColor} fontSize={11} tickLine={false} />
        <YAxis stroke={textColor} fontSize={11} tickLine={false} allowDecimals={false} />
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey="total"
          name="Posts"
          stroke="#3a6aa0"
          strokeWidth={2.5}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="high"
          name="High risk"
          stroke="#ef4444"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="medium"
          name="Medium risk"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="low"
          name="Low risk"
          stroke="#10b981"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ModerationBarChart({
  approved,
  rejected,
  pending,
  reports,
}: {
  approved: number;
  rejected: number;
  pending: number;
  reports: number;
}) {
  const { theme } = useTheme();
  const gridColor = theme === 'dark' ? '#16304e' : '#e2e8f0';
  const textColor = theme === 'dark' ? '#94a3b8' : '#64748b';
  const data = [
    { name: 'Pending review', value: pending, color: '#f59e0b' },
    { name: 'Approved', value: approved, color: '#10b981' },
    { name: 'Rejected', value: rejected, color: '#ef4444' },
    { name: 'User reports', value: reports, color: '#8b5cf6' },
  ];
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
        <XAxis dataKey="name" stroke={textColor} fontSize={11} tickLine={false} />
        <YAxis stroke={textColor} fontSize={11} tickLine={false} allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="value" name="Count" radius={[6, 6, 0, 0]}>
          {data.map((row) => (
            <Cell key={row.name} fill={row.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ModelPerformanceChart({
  models,
}: {
  models: ModelPerformanceRow[];
}) {
  const { theme } = useTheme();
  const gridColor = theme === 'dark' ? '#16304e' : '#e2e8f0';
  const textColor = theme === 'dark' ? '#94a3b8' : '#64748b';
  const data = models.map((model) => ({
    name: `${model.algorithm_display} ${model.version_tag}`,
    Accuracy: model.accuracy ?? 0,
    Precision: model.precision ?? 0,
    Recall: model.recall ?? 0,
    F1: model.f1 ?? 0,
  }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
        <XAxis dataKey="name" stroke={textColor} fontSize={10} tickLine={false} />
        <YAxis stroke={textColor} fontSize={11} tickLine={false} domain={[0, 1]} />
        <Tooltip />
        <Legend />
        <Bar dataKey="Accuracy" fill="#3a6aa0" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Precision" fill="#06b6d4" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Recall" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        <Bar dataKey="F1" fill="#10b981" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RiskTrendAreaChart({ data }: { data: ActivityPoint[] }) {
  const { theme } = useTheme();
  const gridColor = theme === 'dark' ? '#16304e' : '#e2e8f0';
  const textColor = theme === 'dark' ? '#94a3b8' : '#64748b';
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis dataKey="date" stroke={textColor} fontSize={11} tickLine={false} />
        <YAxis stroke={textColor} fontSize={11} tickLine={false} allowDecimals={false} />
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey="new_users"
          name="New users"
          stroke="#8b5cf6"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export type { RiskLevel };
