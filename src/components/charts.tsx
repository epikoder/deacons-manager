import { Bar } from "react-chartjs-2";
import {
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";

Chart.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const fmt = (n: number) => Intl.NumberFormat().format(n);

// Chart roles. Delivered/pending are two series of one stack, so they take the first
// two categorical slots (validated: CVD ΔE 24.7, normal-vision ΔE 33.6, both >= 3:1).
export const VIZ = {
  delivered: "#2a78d6",
  pending: "#eb6834",
  bar: "#2a78d6",
  surface: "#ffffff",
  grid: "#f0f0ee",
  textPrimary: "#18181b",
  textSecondary: "#71717a",
};
export const FONT = { family: "Outfit", size: 11 };

export const tooltipStyle = {
  backgroundColor: "#18181b",
  titleFont: { ...FONT, size: 12, weight: "bold" as const },
  bodyFont: { ...FONT, size: 12 },
  padding: 10,
  cornerRadius: 8,
  boxPadding: 4,
  usePointStyle: true,
};

/** Delivered and pending orders, stacked, one column per label (day or month). */
export function StackedOrdersChart(
  { labels, delivered, pending, height = "h-72" }: {
    labels: string[];
    delivered: number[];
    pending: number[];
    height?: string;
  },
) {
  return (
    <div className={height}>
      <Bar
        data={{
          labels,
          datasets: [
            {
              label: "Delivered",
              data: delivered,
              backgroundColor: VIZ.delivered,
              maxBarThickness: 24,
              borderSkipped: "start",
            },
            {
              // The top segment carries the rounded data-end and a 2px surface gap
              // separating it from the segment below.
              label: "Pending delivery",
              data: pending,
              backgroundColor: VIZ.pending,
              borderColor: VIZ.surface,
              borderWidth: { top: 0, bottom: 2, left: 0, right: 0 },
              borderRadius: { topLeft: 4, topRight: 4 },
              borderSkipped: false,
              maxBarThickness: 24,
            },
          ],
        }}
        options={{
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          scales: {
            x: {
              stacked: true,
              grid: { display: false },
              border: { color: "#d4d4d8" },
              ticks: { color: VIZ.textSecondary, font: FONT },
            },
            y: {
              stacked: true,
              beginAtZero: true,
              grid: { color: VIZ.grid },
              border: { display: false },
              ticks: {
                color: VIZ.textSecondary,
                font: FONT,
                precision: 0,
                maxTicksLimit: 6,
              },
            },
          },
          plugins: {
            legend: {
              position: "top",
              align: "end",
              labels: {
                usePointStyle: true,
                pointStyle: "rectRounded",
                boxWidth: 8,
                boxHeight: 8,
                color: VIZ.textPrimary,
                font: { ...FONT, size: 12 },
              },
            },
            tooltip: {
              ...tooltipStyle,
              callbacks: {
                footer: (items) =>
                  `Total: ${fmt(items.reduce((s, i) => s + (i.raw as number), 0))}`,
              },
            },
          },
        }}
      />
    </div>
  );
}
