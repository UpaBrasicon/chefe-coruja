import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from './ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { cn } from '../lib/utils'

export default function ComboboxMedico({ medicos, value, onChange, disabled }) {
  const [aberto, setAberto] = useState(false)
  const selecionado = medicos.find(m => m.id === value)

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={aberto}
          disabled={disabled}
          className="w-full justify-between font-normal"
          style={{ borderColor: 'var(--cor-borda)', color: selecionado ? 'var(--cor-texto)' : 'var(--cor-texto-suave)' }}
        >
          {selecionado ? `${selecionado.nome} — CRM ${selecionado.crm}` : 'Selecione o médico...'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" style={{ minWidth: '280px' }}>
        <Command>
          <CommandInput placeholder="Buscar por nome ou CRM..." />
          <CommandList>
            <CommandEmpty>Nenhum médico encontrado.</CommandEmpty>
            <CommandGroup>
              {medicos.map(m => (
                <CommandItem
                  key={m.id}
                  value={`${m.nome} ${m.crm}`}
                  onSelect={() => {
                    onChange(m.id)
                    setAberto(false)
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === m.id ? 'opacity-100' : 'opacity-0')} />
                  <span>{m.nome}</span>
                  <span className="ml-auto text-xs opacity-50">CRM {m.crm}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
