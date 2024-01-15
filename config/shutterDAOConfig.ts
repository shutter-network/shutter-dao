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

  // The initial keyper set that is associated with the DAO. Taken from the Shutter keyper set 1 as deployed on Gnosis chain at `0x5162f51ef5cb9d12f5f64e17fc910d17af37f833`
  initialKeyperSet: {
    keypers: [
      "0x52e94E093a162F1D3D5481828cfaB3807Ea32b3A",
      "0x1c0a6fDd52A0c3F18cd6640695884e6248a13533",
      "0x618509C70Bd8b97b78B43c6AF081a55f7225901f",
      "0x3cA93C6c6E3081B26eCA2af4ec2E50d1BA975aE4",
      "0x90A09a9797A04CA679D8F8A6748f728D8f49F34B",
      "0x7238E49003771F9A1bE44585483979c69B6b0F5c",
      "0x23d33956940083e0E92Dd608D6E576AfbEcc83a9",
      "0x772213aaD4c6B37d2cc0Fa3B74F9ace5a028B8C8",
      "0xcB43AEAA8c029Da18A499dC684FdD250ab3FCd13",
      "0xf8A17443c1e98535aBe4D6D9Fdb9C99E8D36D87a",
      "0xfc7d75e4bb6D18591cDc1E766CE7cF231bc08fBc",
      "0xE1A425b2726D92Bc5178e7F5Ed30256481F5337f",
      "0x322F63e33B35CD227a51ae2B8b7Ef9EB8Ca8A238",
    ],
    collator: "0xe67b35a6eC0F206F28C72c32c6F9dA55D8c3943D",
    thresholdRatio: 0.3,
    activationBlock: 18234313,
  },
};
