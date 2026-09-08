import { useState } from 'react'

export default function AddRow({ placeholder, onAdd }) {
  const [value, setValue] = useState('')

  function submit() {
    if (!value.trim()) return
    onAdd(value.trim())
    setValue('')
  }

  return (
    <div className="panel-add">
      <input
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      <button className="ghost" onClick={submit}>
        Add
      </button>
    </div>
  )
}
