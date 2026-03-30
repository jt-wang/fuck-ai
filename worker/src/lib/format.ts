interface FormatInput {
  display_name: string;
  current_fucks: number;
  baseline_mean: number;
  z_score: number;
  fuck_score: number;
  status: string;
  other_models: { display_name: string; current_fucks: number; fuck_score: number; status: string }[];
}

export function formatFuckText(d: FormatInput): string {
  const lines: string[] = ['Recorded. You\'re not alone.', ''];

  if (d.fuck_score === 0) {
    lines.push(`${d.display_name}: calibrating (${d.current_fucks} fucks/hr)`);
    lines.push('  Need more /fucks to build baseline');
  } else {
    lines.push(`${d.display_name}: ${d.fuck_score}/5 (${d.status})`);
    const parts = [`${d.current_fucks} fucks/hr`];
    if (d.baseline_mean > 0) parts.push(`baseline ~${d.baseline_mean}`);
    if (d.z_score !== 0) parts.push(`z=${d.z_score}`);
    lines.push(`  ${parts.join(', ')}`);
    if (d.z_score > 1.5) lines.push('  Getting more complaints than usual');
    if (d.z_score < -0.5) lines.push('  Quieter than usual — might actually be good right now');
  }

  const others = d.other_models
    .filter((m) => m.current_fucks > 0)
    .sort((a, b) => (a.fuck_score || 99) - (b.fuck_score || 99))
    .slice(0, 5);

  if (others.length > 0) {
    lines.push('');
    lines.push('Other models right now:');
    for (const m of others) {
      const s = m.fuck_score > 0 ? `${m.fuck_score}/5 (${m.status})` : 'calibrating';
      lines.push(`  ${m.display_name.padEnd(20)} ${s.padEnd(18)} ${m.current_fucks} fucks/hr`);
    }
  }

  lines.push('');
  lines.push('fuck-ai.dev');
  return lines.join('\n');
}
