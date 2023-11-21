import { ShutterDAOConfig } from '../DaoBuilder/types';

// @note 1 block = ~15 seconds
// @note 1 day = 5760 blocks
// @note 1 week = 40320 blocks

const ONE_YEAR = 365 * 24 * 60 * 60;
const NOW = Math.floor(Date.now() / 1000);

export const shutterDAOConfig: ShutterDAOConfig = {
  // name of the DAO
  name: 'Shutter DAO',
  // Lock Release | start timestamp of the release schedule
  lockStart: NOW, // (seconds)
  // Lock Release | duration of the release schedule in seconds
  lockDuration: ONE_YEAR, // (seconds)
  // Snapshot | url of the snapshot page
  snapshotURL: 'https://snapshot.org/#/shutterprotodao.eth',
  // ShutterToken | initial supply of the token
  initialSupply: '100000000', // (+18 decimals)
  // Linear Strategy |  Length of time that voting occurs
  votingPeriod: 5, // (blocks)
  // Linear Strategy | Length of time between when a proposal is passed and when it can be actually be executed.  For the top level Decent DAO we may want to have this be 0
  timeLockPeriod: 0, // (blocks)
  // Linear Strategy | Length of time that a successful proposal has to be executed, after which is will expire.  We can simply set this to the the same length decided on for Voting Period.
  executionPeriod: 86400, // (blocks)
  // Linear Strategy | Percentage of total possible tokens that must vote in order to consider a proposal result valid.  We should take into account that a large portion of tokens will be locked for investors, who may never vote.
  quorum: 4, // (basis points)
  // Linear Strategy | Percentage of total possible tokens that must vote YES in order to pass a proposal.  Suggested 50% for a simple majority.
  votingBasis: 500000, // (basis points)
  // Linear Strategy | Percentage of total possible tokens that must be delegated to a user in order for them to create a proposal.  Suggested 1%.
  proposalRequiredWeight: 0, // (basis points)
};
