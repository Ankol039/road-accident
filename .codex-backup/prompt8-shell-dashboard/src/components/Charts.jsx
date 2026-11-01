/**
 * Chart.js wrappers with the same dark burnt-orange theme the PHP app used.
 * Replaces the canvas + new Chart(...) code in pages/admin.js and
 * pages/admin-summaries.js.
 */
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar, Doughnut, Pie, Line } from 'react-chartjs-2'
import { CHART_COLORS } from '../lib/constants.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
)

ChartJS.defaults.color = CHART_COLORS.muted
ChartJS.defaults.font.family = "'Inter', system-ui, sans-serif"
ChartJS.defaults.borderColor = CHART_COLORS.grid

/** Shared options so every chart has the same grid, legend and tooltip look. */
export const baseOptions = ({ legend = false, horizontal = false } = {}) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: legend,
      labels: { color: CHART_COLORS.ink, boxWidth: 12, usePointStyle: true },
    },
    tooltip: {
      backgroundColor: CHART_COLORS.tooltipBg,
      titleColor: CHART_COLORS.ink,
      bodyColor: CHART_COLORS.ink,
      borderColor: CHART_COLORS.grid,
      borderWidth: 1,
      padding: 10,
    },
  },
  scales: horizontal
    ? {
        x: {
          beginAtZero: true,
          grid: { color: CHART_COLORS.grid },
          ticks: { color: CHART_COLORS.muted, precision: 0 },
        },
        y: { grid: { display: false }, ticks: { color: CHART_COLORS.muted } },
      }
    : {
        x: { grid: { display: false }, ticks: { color: CHART_COLORS.muted } },
        y: {
          beginAtZero: true,
          grid: { color: CHART_COLORS.grid },
          ticks: { color: CHART_COLORS.muted, precision: 0 },
        },
      },
})

/** Bar chart from [{label, value}] data. */
export function Bars({ data, horizontal = false, height = 260, color = CHART_COLORS.bar }) {
  const chart = {
    labels: data.map((d) => d.label),
    datasets: [
      {
        data: data.map((d) => d.value),
        backgroundColor: color,
        hoverBackgroundColor: CHART_COLORS.barHover,
        borderRadius: 4,
        maxBarThickness: 38,
      },
    ],
  }
  return (
    <div className="chart-box" style={{ height }}>
      <Bar data={chart} options={baseOptions({ horizontal })} />
    </div>
  )
}

/** Line chart, used by the summaries trend. */
export function Trend({ data, height = 260, color = CHART_COLORS.bar }) {
  const chart = {
    labels: data.map((d) => d.label),
    datasets: [
      {
        data: data.map((d) => d.value),
        borderColor: color,
        backgroundColor: 'rgba(228, 87, 46, 0.18)',
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: color,
      },
    ],
  }
  return (
    <div className="chart-box" style={{ height }}>
      <Line data={chart} options={baseOptions()} />
    </div>
  )
}

const PIE_PALETTE = [
  '#e4572e', '#f2b705', '#0f6b4c', '#c8322b', '#0b6e8a',
  '#43378c', '#6fe0a1', '#f19a7a', '#b3a6f0', '#86d6ea',
]

/** Pie / doughnut for status and type splits. */
export function Split({ data, doughnut = true, height = 260 }) {
  const chart = {
    labels: data.map((d) => d.label),
    datasets: [
      {
        data: data.map((d) => d.value),
        backgroundColor: data.map((_, i) => PIE_PALETTE[i % PIE_PALETTE.length]),
        borderColor: '#171c1f',
        borderWidth: 2,
      },
    ],
  }
  const options = baseOptions({ legend: true })
  delete options.scales
  return (
    <div className="chart-box" style={{ height }}>
      {doughnut ? <Doughnut data={chart} options={options} /> : <Pie data={chart} options={options} />}
    </div>
  )
}
