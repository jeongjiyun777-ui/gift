interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export default function DrivingTimeSelect({ id, label, value, onChange }: Props) {
  const [hour = "", minute = ""] = value.split(":");
  const selectClass = "w-full min-w-0 rounded-lg border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 font-semibold">{label}</legend>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <select id={`${id}-hour`} aria-label={`${label} 시`} value={hour} onChange={(event) => onChange(`${event.target.value}:${minute}`)} className={selectClass}>
          <option value="">시 선택</option>
          {Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0")).map((item) => <option key={item} value={item}>{item}시</option>)}
        </select>
        <span aria-hidden="true">:</span>
        <select id={`${id}-minute`} aria-label={`${label} 분`} value={minute} onChange={(event) => onChange(`${hour}:${event.target.value}`)} className={selectClass}>
          <option value="">분 선택</option>
          {Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0")).map((item) => <option key={item} value={item}>{item}분</option>)}
        </select>
      </div>
    </fieldset>
  );
}
