# Shutter DAO blueprint

This is the official blueprint for the Shutter DAO. Below, you will find the instructions to deploy the Shutter DAO and how to modify the configuration parameters.

This repo comes with a default suggestion. If you intend to deploy with the proposed configuration, you can skip the step `Modify DAO Parameters`.

## 1) Configuration
Create a `.env` file in the root depository of the project.

For your convenience, you execute the following command in the repository's root directory.

``` 
cp .env.example .env
```

Configure the following parameters:

```
# Etherscan API key to verify the contracts
ETHERSCAN_API_KEY=
# Ethereum mainnet RPC provider
MAINNET_PROVIDER=
# Private key used to deploy and configure the contracts
MAINNET_DEPLOYER_PRIVATE_KEY=
```

Make sure to have the account funded with at least XXX ETH. Note that the total costs to deploy the DAO depend on the actual gas price.

## 2) Modify DAO parameters

If you want to alter the DAO parameter settings, you can make the following changes:

### Changing token allocations and vesting schedules
You need to generate a new Merkle root hash to change token allocation and vesting schedules. Please visit https://github.com/shutter-network/shutter-dao-claiming-app-data and follow the README. Modify the CSV files to your needs and execute the Merkle root hash generation. Replace the parameter
`airdropRootHash` in `config/shutterDaoConfig.ts` with the generated value.

### DAO gonvernance parameters
Inside the `config` directory:
- `shutterDAOConfig.ts`

```
  name: 'Shutter DAO',
  // Snapshot | URL of the snapshot page
  snapshotURL: '',
  // Linear Strategy |  Length of time that voting occurs
  votingPeriodBlocks: 5, // (blocks)
  // Linear Strategy | Length of time between when a proposal is passed and when it can be executed. For the top-level Decent DAO, we may want to have this be 0
  timeLockPeriodBlocks: 0, // (blocks)
  // Linear Strategy | Length of time that a successful proposal has to be executed, after which it will expire. We can set this to the same length decided on for the Voting Period.
  executionPeriodBlocks: 86400, // (blocks)
  // Linear Strategy | Percentage of total possible tokens that must be voted on to consider a proposal result valid. We should consider that many tokens will be locked for investors, who may never vote.
  quorumBasisNumerator: 4, // (basis points, will be divided by 1_000_000)
  // Linear Strategy | Percentage of total possible tokens that must vote YES to pass a proposal. Suggested 50% for a simple majority.
  votingBasisNumerator: 500000, // (basis points, will be divided by 1_000_000)
  // Linear Strategy | Percentage of total possible tokens that must be delegated to a user for them to create a proposal. The suggested number is 1%.
  proposalRequiredWeightTokens: 0,  // (delegated voting token balance)
```

## 3) Deploy DAO

execute 

### Set up environment

Requirements: 

- Node.js >=v18

In the root directory, execute

```
npm install
```

### Run deployment command

After configuring all necessary files, as in the steps above, execute the following commands in the root directory.
``` 
npx hardhat --network mainnet deploy-contracts
```


# Test
```
npm run test
```
