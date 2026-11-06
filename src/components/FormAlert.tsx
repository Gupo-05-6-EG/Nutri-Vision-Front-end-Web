interface Props {
  message: string;
  tone?: 'error' | 'info';
}

export function FormAlert({ message, tone = 'error' }: Props) {
  return (
    <p className={`alert alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {message}
    </p>
  );
}
