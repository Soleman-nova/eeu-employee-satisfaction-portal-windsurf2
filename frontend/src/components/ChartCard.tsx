import React from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts'
import { useTheme } from '@/context/ThemeContext'

type Props = {
  title: string
  data: Array<{ name: string; value: number }>
  onBarClick?: (entry: { name: string; value: number }) => void
  xLabelPrefix?: string
  valueLabel?: string
  allowDecimals?: boolean
}

export default function ChartCard({
  title,
  data,
  onBarClick,
  xLabelPrefix = 'Rating',
  valueLabel = 'Count',
  allowDecimals = false,
}: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div className="bg-white rounded border p-4">
      <h3 className="font-semibold mb-2">{title}</h3>
      <div className="w-full h-64">
        <ResponsiveContainer>
          <BarChart data={data}>
            <XAxis dataKey="name" />
            <YAxis allowDecimals={allowDecimals} />
            <Tooltip
              formatter={(value: any) => [value, valueLabel]}
              labelFormatter={(label: any) => `${xLabelPrefix}: ${label}`}
              contentStyle={
                isDark
                  ? { backgroundColor: 'rgb(15 23 42)', border: '1px solid rgb(51 65 85)', color: 'rgb(241 245 249)' }
                  : undefined
              }
              labelStyle={isDark ? { color: 'rgb(226 232 240)' } : undefined}
              itemStyle={isDark ? { color: 'rgb(241 245 249)' } : undefined}
            />
            <Legend />
            <Bar
              name={valueLabel}
              dataKey="value"
              fill="#1e3a8a"
              onClick={(entry: any) => {
                if (onBarClick && entry && entry.payload) onBarClick(entry.payload)
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
