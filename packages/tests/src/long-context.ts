export function makeLongRecords(count: number, finalToken: string): string {
  const filler =
    "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon phi chi psi omega";
  const records: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const token = i === count - 1 ? finalToken : `checksum_${String(i).padStart(4, "0")}`;
    records.push(`record ${i}: ${filler} ${filler} ${filler} token=${token}`);
  }
  return records.join("\n");
}
