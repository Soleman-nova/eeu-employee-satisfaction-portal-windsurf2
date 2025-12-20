import React from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts'

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
