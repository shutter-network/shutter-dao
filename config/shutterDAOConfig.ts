import { ShutterDAOConfig } from '../DaoBuilder/types';

// @note 1 block = ~15 seconds
// @note 1 day = 5760 blocks
// @note 1 week = 40320 blocks

const ONE_YEAR = 365 * 24 * 60 * 60;
const NOW = Math.floor(Date.now() / 1000);

export const shutterDAOConfig: ShutterDAOConfig = {
  // name of the DAO
  name: 'Shutter DAO',
  // Snapshot | url of the snapshot page
  snapshotURL: 'https://snapshot.org/#/shutterprotodao.eth',
  // Linear Strategy |  Length of time that voting occurs
  votingPeriodBlocks: 5, // (blocks)
  // Linear Strategy | Length of time between when a proposal is passed and when it can be actually be executed.  For the top level Decent DAO we may want to have this be 0
  timeLockPeriodBlocks: 0, // (blocks)
  // Linear Strategy | Length of time that a successful proposal has to be executed, after which is will expire.  We can simply set this to the the same length decided on for Voting Period.
  executionPeriodBlocks: 86400, // (blocks)
  // Linear Strategy | Percentage of total possible tokens that must vote in order to consider a proposal result valid.  We should take into account that a large portion of tokens will be locked for investors, who may never vote.
  quorumBasisNumerator: 4, // (basis points, will be divided by 1_000_000)
  // Linear Strategy | Percentage of total possible tokens that must vote YES in order to pass a proposal.  Suggested 50% for a simple majority.
  votingBasisNumerator: 500000, // (basis points, will be divided by 1_000_000)
  // Linear Strategy | Percentage of total possible tokens that must be delegated to a user in order for them to create a proposal.  Suggested 1%.
  proposalRequiredWeightTokens: 0,  // (delegated voting token balance)
};
