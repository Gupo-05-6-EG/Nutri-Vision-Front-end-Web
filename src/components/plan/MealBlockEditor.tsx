import { useId } from 'react';
import { FoodPicker } from '@/components/plan/FoodPicker';
import {
  type DraftErrors,
  type FoodDraft,
  type MealDraft,
  LIMITS,
  MEAL_NAME_SUGGESTIONS,
  emptyFood,
  estimateMeal,
  parseNumber,
} from '@/lib/plans';

interface Props {
  meal: MealDraft;
  index: number;
  total: number;
  errors: DraftErrors;
  onChange: (meal: MealDraft) => void;
  onMove: (offset: -1 | 1) => void;
  onRemove: () => void;
}

const formatKcal = (value: number) => Math.round(value).toLocaleString('pt-BR');
const formatGrams = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

/** Um bloco de refeição do plano: nome, horário, metas e alimentos. */
export function MealBlockEditor({ meal, index, total, errors, onChange, onMove, onRemove }: Props) {
  const id = useId();
  const suggestionsId = `${id}-sugestoes`;
  const set = (patch: Partial<MealDraft>) => onChange({ ...meal, ...patch });
  const setFood = (key: string, patch: Partial<FoodDraft>) =>
    set({ foods: meal.foods.map((food) => (food.key === key ? { ...food, ...patch } : food)) });

  const estimate = estimateMeal(meal);
  const goalKcal = parseNumber(meal.goalKcal);
  const goalProtein = parseNumber(meal.goalProtein);

  const error = (field: string) => errors[`${meal.key}.${field}`];
  const errorId = (key: string, field: string) => `${id}-${key}-${field}-erro`;

  return (
    <fieldset className="card meal-block">
      <legend>Refeição {index + 1}</legend>

      <div className="meal-block__actions">
        <button
          type="button"
          className="icon-button"
          onClick={() => onMove(-1)}
          disabled={index === 0}
          aria-label={`Mover ${meal.name || 'refeição'} para cima`}
        >
          ↑
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={() => onMove(1)}
          disabled={index === total - 1}
          aria-label={`Mover ${meal.name || 'refeição'} para baixo`}
        >
          ↓
        </button>
        <button
          type="button"
          className="icon-button icon-button--danger"
          onClick={onRemove}
          disabled={total === 1}
          aria-label={`Remover ${meal.name || 'refeição'}`}
        >
          ✕
        </button>
      </div>

      <div className="grid grid--meal">
        <label className="field field--wide">
          <span>Nome</span>
          <input
            type="text"
            list={suggestionsId}
            maxLength={LIMITS.mealName}
            value={meal.name}
            aria-invalid={Boolean(error('name'))}
            aria-describedby={error('name') ? errorId(meal.key, 'name') : undefined}
            onChange={(event) => set({ name: event.target.value })}
          />
          <datalist id={suggestionsId}>
            {MEAL_NAME_SUGGESTIONS.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          {error('name') && (
            <small className="field__error" id={errorId(meal.key, 'name')}>
              {error('name')}
            </small>
          )}
        </label>

        <label className="field">
          <span>Horário</span>
          <input type="time" value={meal.time} onChange={(e) => set({ time: e.target.value })} />
        </label>

        <label className="field">
          <span>Meta (kcal)</span>
          <input
            type="text"
            inputMode="decimal"
            value={meal.goalKcal}
            aria-invalid={Boolean(error('goalKcal'))}
            aria-describedby={error('goalKcal') ? errorId(meal.key, 'goalKcal') : undefined}
            onChange={(event) => set({ goalKcal: event.target.value })}
          />
          {error('goalKcal') && (
            <small className="field__error" id={errorId(meal.key, 'goalKcal')}>
              {error('goalKcal')}
            </small>
          )}
        </label>

        <label className="field">
          <span>Meta de proteínas (g)</span>
          <input
            type="text"
            inputMode="decimal"
            value={meal.goalProtein}
            aria-invalid={Boolean(error('goalProtein'))}
            aria-describedby={error('goalProtein') ? errorId(meal.key, 'goalProtein') : undefined}
            onChange={(event) => set({ goalProtein: event.target.value })}
          />
          {error('goalProtein') && (
            <small className="field__error" id={errorId(meal.key, 'goalProtein')}>
              {error('goalProtein')}
            </small>
          )}
        </label>
      </div>

      <h3 className="meal-block__subtitle">Alimentos</h3>
      {error('foods') && <p className="field__error">{error('foods')}</p>}
      <ul className="food-list">
        {meal.foods.map((food) => {
          const nameError = errors[`${food.key}.name`];
          const gramsError = errors[`${food.key}.grams`];
          return (
            <li key={food.key} className="food-row">
              <div className="field field--grow">
                <FoodPicker
                  value={food.name}
                  tacoId={food.tacoId}
                  invalid={Boolean(nameError)}
                  describedBy={nameError ? errorId(food.key, 'name') : undefined}
                  onType={(name) => setFood(food.key, { name, tacoId: null, taco: null })}
                  onPick={(taco) => setFood(food.key, { name: taco.nome, tacoId: taco.id, taco })}
                />
                {nameError && (
                  <small className="field__error" id={errorId(food.key, 'name')}>
                    {nameError}
                  </small>
                )}
              </div>
              <div className="field field--grams">
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label="Quantidade em gramas"
                  placeholder="g"
                  value={food.grams}
                  aria-invalid={Boolean(gramsError)}
                  aria-describedby={gramsError ? errorId(food.key, 'grams') : undefined}
                  onChange={(event) => setFood(food.key, { grams: event.target.value })}
                />
                {gramsError && (
                  <small className="field__error" id={errorId(food.key, 'grams')}>
                    {gramsError}
                  </small>
                )}
              </div>
              <button
                type="button"
                className="icon-button icon-button--danger"
                onClick={() => set({ foods: meal.foods.filter((f) => f.key !== food.key) })}
                disabled={meal.foods.length === 1}
                aria-label={`Remover ${food.name || 'alimento'}`}
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="link-button"
        onClick={() => set({ foods: [...meal.foods, emptyFood()] })}
        disabled={meal.foods.length >= LIMITS.foodsPerMeal}
      >
        + Adicionar alimento
      </button>

      {estimate.counted > 0 && (
        <p className="meal-block__estimate">
          Estimativa dos alimentos da TACO ({estimate.counted} de {meal.foods.length}):{' '}
          <strong className={estimate.kcal > goalKcal ? 'over' : undefined}>
            {formatKcal(estimate.kcal)} kcal
          </strong>
          {Number.isNaN(goalKcal) ? '' : ` de ${formatKcal(goalKcal)}`} ·{' '}
          <strong>{formatGrams(estimate.protein)} g de proteína</strong>
          {Number.isNaN(goalProtein) ? '' : ` de ${formatGrams(goalProtein)}`}
        </p>
      )}

      <label className="field">
        <span>Observações da refeição</span>
        <textarea
          rows={2}
          maxLength={LIMITS.mealNote}
          value={meal.note}
          onChange={(event) => set({ note: event.target.value })}
        />
      </label>
    </fieldset>
  );
}
