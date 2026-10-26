import { useEffect, useId, useRef, useState } from 'react';
import { LIMITS, searchTaco } from '@/lib/plans';
import type { TacoFood } from '@/types/plan';

interface Props {
  value: string;
  tacoId: number | null;
  invalid: boolean;
  describedBy?: string;
  /** Texto livre: desfaz a escolha da TACO. */
  onType: (name: string) => void;
  onPick: (food: TacoFood) => void;
}

const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;

/**
 * Campo de alimento com sugestões da TACO (combobox).
 *
 * Escolher uma sugestão liga o alimento à TACO (`alimento_taco_id`) e traz os
 * valores por 100g para a estimativa do bloco; continuar digitando volta a ser
 * texto livre.
 */
export function FoodPicker({ value, tacoId, invalid, describedBy, onType, onPick }: Props) {
  const listId = useId();
  const [results, setResults] = useState<TacoFood[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [query, setQuery] = useState('');
  const requestId = useRef(0);

  useEffect(() => {
    // Consulta curta: so invalida respostas pendentes (a lista some pelo render).
    const id = ++requestId.current;
    if (query.trim().length < MIN_CHARS) return;
    const timer = setTimeout(() => {
      searchTaco(query.trim())
        .then((found) => {
          if (id !== requestId.current) return;
          setResults(found);
          setActive(-1);
        })
        .catch(() => {
          // Sem sugestões: o nutricionista ainda pode digitar o alimento livre.
          if (id === requestId.current) setResults([]);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const pick = (food: TacoFood) => {
    onPick(food);
    setOpen(false);
    setResults([]);
    setQuery('');
  };

  const showList = open && query.trim().length >= MIN_CHARS && results.length > 0;

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter aqui escolhe sugestão, nunca envia o plano pela metade.
    if (event.key === 'Enter' && active < 0) event.preventDefault();
    if (!showList) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => (index + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => (index <= 0 ? results.length - 1 : index - 1));
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      pick(results[active]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="food-picker">
      <input
        type="text"
        role="combobox"
        aria-label="Alimento"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        placeholder="Buscar na TACO ou digitar"
        maxLength={LIMITS.foodName}
        value={value}
        onChange={(event) => {
          onType(event.target.value);
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
      />
      {tacoId !== null && (
        <span className="badge" title="Alimento ligado à tabela TACO">
          TACO
        </span>
      )}
      {showList && (
        <ul id={listId} role="listbox" className="food-picker__list">
          {results.map((food, index) => (
            <li
              key={food.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              // mousedown, e não click: o blur do input fecharia a lista antes.
              onMouseDown={(event) => {
                event.preventDefault();
                pick(food);
              }}
            >
              <span>{food.nome}</span>
              <small>
                {food.kcal_100g} kcal · {food.prot_100g} g prot / 100 g
              </small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
