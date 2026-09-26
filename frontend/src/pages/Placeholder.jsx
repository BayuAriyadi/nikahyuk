export default function Placeholder({ title, copy }) {
  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
        {copy}
      </div>
    </section>
  )
}
