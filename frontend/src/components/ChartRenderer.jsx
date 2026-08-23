import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Funnel, FunnelChart,
  LabelList, Legend, Line, LineChart, Pie, PieChart, ReferenceLine,
  ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
  Treemap, ZAxis,
} from 'recharts';
import { fmtFull } from '../utils/format';
import { CHART_COLORS, COLORS, TREEMAP_STATUS_COLORS } from '../theme';

const tooltipStyle = {
  background: '#fff',
  border: '1px solid var(--border)',
  borderRadius: 10,
  fontSize: 12.5,
  boxShadow: '0 4px 14px rgba(15,23,42,.12)',
};

const nairaFormatter = (v) => (Math.abs(v) >= 10000 ? fmtFull(v) : v);
const pctAxis = (v) => `${v}%`;

function FunnelView({ data }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <FunnelChart>
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtFull(v)} />
        <Legend payload={data.map((d, i) => ({
          id: d.stage ?? d.name ?? String(i),
          value: d.stage ?? d.name ?? String(i),
          type: 'square',
          color: CHART_COLORS[i % CHART_COLORS.length],
        }))} />
        <Funnel dataKey="value" nameKey="stage" data={data} isAnimationActive>
          {data.map((d, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
          <LabelList position="right" dataKey="stage" fill="#334155" stroke="none" fontSize={11} />
        </Funnel>
      </FunnelChart>
    </ResponsiveContainer>
  );
}

function StatusTreemap({ data }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <Treemap
        data={data}
        dataKey="size"
        stroke="#fff"
        content={({ x, y, width, height, name, status }) => (
          <g>
            <rect x={x} y={y} width={width} height={height}
                  fill={TREEMAP_STATUS_COLORS[status] || COLORS.primary} opacity={0.88} rx={4} />
            {width > 90 && height > 34 && (
              <>
                <text x={x + 8} y={y + 18} fill="#fff" fontSize={11} fontWeight={700}>{name}</text>
                {height > 56 && <text x={x + 8} y={y + 34} fill="#E2E8F0" fontSize={10}>{status}</text>}
              </>
            )}
          </g>
        )}
      >
        <Tooltip content={({ payload }) => payload?.[0]
          ? `${payload[0].payload.name} — ${fmtFull(payload[0].payload.size)} (${payload[0].payload.status})`
          : ''} />
      </Treemap>
    </ResponsiveContainer>
  );
}

export default function ChartRenderer({ analysis, height = 280 }) {
  if (!analysis?.chart || !analysis.chart.data?.length) return null;
  const { type, x_axis: xAxis, y_axis: yKeys, data } = analysis.chart;

  if (type === 'pie' || type === 'donut') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={type === 'donut' ? '52%' : 0}
               outerRadius="80%" paddingAngle={type === 'donut' ? 3 : 0}>
            {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtFull(v)} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'treemap') return <StatusTreemap data={data} />;
  if (type === 'funnel') return <FunnelView data={data} />;

  if (type === 'line') {
    const multi = yKeys.length > 1;
    const series = multi ? yKeys : [yKeys[0]];
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EDF1F9" />
          <XAxis dataKey={xAxis} tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={nairaFormatter} tick={{ fontSize: 10 }} width={72} />
          <Tooltip contentStyle={tooltipStyle}
                   formatter={(v, n) => [String(n).includes('%') ? `${v}%` : fmtFull(v), n]} />
          {multi && <Legend />}
          {series.map((k, i) => (
            <Line key={k} type="monotone" dataKey={k} strokeWidth={2.5}
                  stroke={multi ? CHART_COLORS[i % CHART_COLORS.length] : COLORS.sky}
                  dot={{ r: 3 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'bubble' || type === 'scatter_quadrant') {
    const isPct = type === 'bubble';
    return (
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top: 12, right: 20, bottom: 24, left: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EDF1F9" />
          <XAxis dataKey={isPct ? 'Delay Rate %' : 'x'} name={xAxis} tick={{ fontSize: 11 }}
                 label={isPct ? { value: `${xAxis}`, position: 'insideBottom', offset: -14, fontSize: 11 } : undefined} />
          <YAxis dataKey={isPct ? 'Avg Rating' : 'y'} name={yKeys[0]} domain={isPct ? [0, 5] : undefined} tick={{ fontSize: 11 }} />
          <ZAxis dataKey={isPct ? 'Volume' : 'z'} range={[70, 500]} />
          {isPct && <ReferenceLine y={3.0} stroke={COLORS.amber} strokeDasharray="4 4" label={{ value: 'rating floor', fontSize: 10 }} />}
          {!isPct && <ReferenceLine y={0} stroke="#CBD5E1" />}
          <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: '3 3' }}
                   formatter={(v, n) => [n === 'Avg Rating' || n === 'Volume' ? v : fmtFull(v), n]} />
          <Scatter data={data} fill={COLORS.primary} fillOpacity={0.75}>
            {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Scatter>
          {isPct && <Legend />}
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'combo') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EDF1F9" />
          <XAxis dataKey={xAxis} tick={{ fontSize: 11 }} />
          <YAxis yAxisId="left" tickFormatter={nairaFormatter} tick={{ fontSize: 10 }} width={72} />
          <YAxis yAxisId="right" orientation="right" tickFormatter={pctAxis} tick={{ fontSize: 11 }} width={44} />
          <Tooltip contentStyle={tooltipStyle}
                   formatter={(v, n) => [n === 'Margin %' ? `${v}%` : fmtFull(v), n]} />
          <Legend />
          <Bar yAxisId="left" dataKey="Revenue" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="Margin %" stroke={COLORS.amber} strokeWidth={2.5} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'bullet_column') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EDF1F9" />
          <XAxis dataKey={xAxis} tick={{ fontSize: 11 }} />
          <YAxis yAxisId="left" tickFormatter={nairaFormatter} tick={{ fontSize: 10 }} width={72} />
          <YAxis yAxisId="right" orientation="right" tickFormatter={pctAxis} tick={{ fontSize: 11 }} width={44} />
          <Tooltip contentStyle={tooltipStyle}
                   formatter={(v, n) => [n === 'Attainment %' ? `${v}%` : fmtFull(v), n]} />
          <Legend />
          <Bar yAxisId="left" dataKey="Target" fill="#94A3B8" radius={[4, 4, 0, 0]} />
          <Bar yAxisId="left" dataKey="Actual" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="Attainment %" strokeWidth={2.5} dot={{ r: 3 }}
                stroke={data.some((d) => d['Attainment %'] < 100) ? COLORS.crimson : COLORS.success} />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'bar_threshold') {
    const threshold = analysis.chart.threshold ?? analysis.facts?.threshold_pct;
    const horizontal = String(data[0][xAxis]).length > 8;
    return (
      <ResponsiveContainer width="100%" height={horizontal ? Math.max(height, data.length * 42) : height}>
        <BarChart layout={horizontal ? 'vertical' : 'horizontal'} data={data}
                  margin={{ top: 12, right: 40, bottom: horizontal ? 4 : 30, left: horizontal ? 60 : 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EDF1F9" />
          {horizontal
            ? (<><XAxis type="number" tickFormatter={pctAxis} tick={{ fontSize: 11 }} /><YAxis type="category" dataKey={xAxis} tick={{ fontSize: 11 }} width={110} /></>)
            : (<><XAxis dataKey={xAxis} tick={{ fontSize: 11 }} /><YAxis tickFormatter={pctAxis} tick={{ fontSize: 11 }} /></>)}
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${v}%`} />
          {threshold != null && (
            <ReferenceLine y={threshold} stroke={COLORS.crimson} strokeDasharray="5 4"
                           label={{ value: `anomaly > ${threshold}%`, position: 'insideTopRight', fontSize: 11, fill: COLORS.crimson }} />
          )}
          <Bar dataKey={yKeys[0]} radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={threshold != null && d[yKeys[0]] > threshold ? COLORS.crimson : COLORS.primary} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  const horizontal = type === 'horizontal_bar'
    || (type === 'bar' && String(data[0][xAxis]).length > 10);

  if (type === 'grouped_column' || type === 'column' || type === 'bar' || type === 'horizontal_bar') {
    const multi = yKeys.length > 1;
    return (
      <ResponsiveContainer width="100%" height={horizontal ? Math.max(height, data.length * 40) : height}>
        <BarChart layout={horizontal ? 'vertical' : 'horizontal'} data={data}
                  margin={{ top: 12, right: 24, bottom: horizontal ? 4 : 34, left: horizontal ? 50 : 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EDF1F9" />
          {horizontal
            ? (<><XAxis type="number" tickFormatter={nairaFormatter} tick={{ fontSize: 10 }} /><YAxis type="category" dataKey={xAxis} tick={{ fontSize: 11 }} width={130} /></>)
            : (<><XAxis dataKey={xAxis} tick={{ fontSize: 11, angle: data.length > 7 ? -28 : 0, textAnchor: data.length > 7 ? 'end' : 'middle' }} height={data.length > 7 ? 58 : 30} /><YAxis tickFormatter={nairaFormatter} tick={{ fontSize: 10 }} width={72} /></>)}
          <Tooltip contentStyle={tooltipStyle}
                   formatter={(v, n) => [String(n).includes('%') ? `${v}%` : fmtFull(v), n]} />
          {multi && <Legend />}
          {(multi ? yKeys : [yKeys[0]]).map((k, ki) => (
            <Bar key={k} dataKey={k} fill={multi ? CHART_COLORS[ki % CHART_COLORS.length] : COLORS.primary}
                 radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return null;
}
