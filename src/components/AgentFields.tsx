/** A labelled field with a hover tooltip, shared by AgentView and AgentDialog. */
export function FieldLabel({
  htmlFor,
  tooltip,
  children,
}: {
  htmlFor: string
  tooltip: string
  children: string
}) {
  return (
    <label className="modal__label" htmlFor={htmlFor} title={tooltip}>
      {children}
    </label>
  )
}

type RangeFieldProps = {
  id: string
  min: number
  max: number
  step: number
  unit: string
  value: number
  onChange: (value: number) => void
}

/** A slider plus its current numeric value, shared by AgentView and AgentDialog. */
export function RangeField({ id, min, max, step, unit, value, onChange }: RangeFieldProps) {
  return (
    <div className="agent-view__range">
      <input
        id={id}
        type="range"
        className="agent-view__range-input"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="agent-view__range-value">
        {value}
        {unit}
      </span>
    </div>
  )
}
