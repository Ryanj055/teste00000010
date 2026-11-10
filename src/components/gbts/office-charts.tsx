import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from "recharts";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/gbts/finance";

type Count = { name: string; value: number };
const tones = [
  "var(--info)",
  "var(--success)",
  "var(--gold)",
  "var(--destructive)",
  "var(--muted-foreground)",
];
const tooltipStyle = {
  background: "var(--card)",
  color: "var(--foreground)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  fontSize: 12,
};

export function DistributionChart({
  title,
  values,
  unit,
  onSelect,
}: {
  title: string;
  values: Count[];
  unit: string;
  onSelect?: (name: string) => void;
}) {
  const total = values.reduce((sum, item) => sum + item.value, 0);
  return (
    <section className="office-chart-section">
      <h2>{title}</h2>
      {total === 0 ? (
        <div className="empty">Nenhum {unit} para os filtros selecionados.</div>
      ) : (
        <div className="office-distribution">
          <div className="office-donut">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={values}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={78}
                  paddingAngle={values.length > 1 ? 3 : 0}
                  stroke="var(--card)"
                  onClick={(item) => onSelect?.(String(item.name))}
                >
                  {values.map((item, index) => (
                    <Cell key={item.name} fill={tones[index % tones.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [value, unit]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <strong>{total}</strong>
              <span>{unit}</span>
            </div>
          </div>
          <ul className="office-chart-legend">
            {values.map((item, index) => (
              <li key={item.name}>
                <span className={`office-swatch tone-${index % tones.length}`} />
                {onSelect ? (
                  <Button
                    variant="ghost"
                    className="chart-filter"
                    onClick={() => onSelect(item.name)}
                  >
                    {item.name}
                  </Button>
                ) : (
                  <span className="chart-category">{item.name}</span>
                )}
                <strong>{item.value}</strong>
                <span>{Math.round((item.value / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function CountBars({
  title,
  values,
  onSelect,
}: {
  title: string;
  values: Count[];
  onSelect?: (name: string) => void;
}) {
  return (
    <section className="office-chart-section">
      <h2>{title}</h2>
      {!values.length ? (
        <div className="empty">Nenhum processo para os filtros selecionados.</div>
      ) : (
        <>
          <div className="office-count-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={values}
                layout="vertical"
                margin={{ top: 8, right: 32, bottom: 12, left: 0 }}
              >
                <CartesianGrid stroke="var(--border)" horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={125}
                  tick={false}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar
                  dataKey="value"
                  name="Processos"
                  fill="var(--info)"
                  maxBarSize={26}
                  radius={[0, 4, 4, 0]}
                  onClick={(item) => onSelect?.(String(item.name))}
                >
                  <LabelList
                    dataKey="value"
                    position="right"
                    fill="var(--foreground)"
                    fontSize={12}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="office-bar-labels">
              {values.map((item) => (
                <div key={item.name}>
                  {onSelect ? (
                    <Button
                      variant="ghost"
                      className="chart-filter"
                      onClick={() => onSelect(item.name)}
                    >
                      {item.name}
                    </Button>
                  ) : (
                    <span>{item.name}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
          <span className="office-axis-label">Quantidade de processos</span>
        </>
      )}
    </section>
  );
}

export function CashComparison({
  values,
}: {
  values: { name: string; received: number; expense: number }[];
}) {
  return (
    <>
      {!values.length ? (
        <div className="empty">Nenhuma movimentação no período.</div>
      ) : (
        <>
          <div className="office-cash-legend">
            <span>
              <i className="office-swatch tone-0" />
              Recebimentos realizados
            </span>
            <span>
              <i className="office-swatch tone-2" />
              Despesas pagas
            </span>
          </div>
          <div className="office-cash-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={values} margin={{ top: 16, right: 12, left: 0, bottom: 12 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 4" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  width={65}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickFormatter={(value) =>
                    new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(value)
                  }
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => money(value)} />
                <Bar
                  dataKey="received"
                  name="Recebimentos realizados"
                  fill="var(--info)"
                  maxBarSize={36}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="expense"
                  name="Despesas pagas"
                  fill="var(--gold)"
                  maxBarSize={36}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <span className="office-axis-label">Valores em R$ · mês da movimentação</span>
        </>
      )}
    </>
  );
}
