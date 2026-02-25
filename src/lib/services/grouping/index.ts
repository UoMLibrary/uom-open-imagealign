/**
 * Grouping Strategies Index
 * 
 * Organized as pluggable strategies in services layer.
 * Each strategy is independent and can be combined.
 */

export type { GroupingProposal } from './types';

export { groupByIndividual } from './individual';
export { groupByFilename } from './filename';
export { groupByLeafFolder } from './leafFolder';
export { groupByPHash } from './phash';
export { groupByVisualProfile } from './visualProfile';
