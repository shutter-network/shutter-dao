# Shutter DAO template

This is the official blueprint for the Shutter DAO. Below you will find the instructions to deploy the Shutter DAO
and how to modify the configuration parameters.

This repo comes with a default suggestion. If you intend to deploy with the proposed configuration, you can skip the
step `Modify DAO Parameters`.

## 1) Configuration
Create a `.env` file in the root depository of the project.

For your convenience you simply execute the following command in the root directory of the repository.

``` 
cp .env.example .env
```

Configure the following parameters:

```
# Etherscan api key to verify the contracts
ETHERSCAN_API_KEY=
# Ethereum mainnet rpc provider
MAINNET_PROVIDER=
# Private key used to deploy and configure the contracts
MAINNET_DEPLOYER_PRIVATE_KEY=
```

Make sure to have the account funded with at least XXX ETH. Note, that the total costs to deploy the DAO
depend on the actual gas price.

## 2) Modify DAO parameters

If you want to alter the DAO parameter settings, you can make the following changes:

### Changing token allocations and vesting schedules
In order to change token allocation and vesting schedules you need to generate a new merkle root hash.
Please visit https://github.com/shutter-network/shutter-dao-claiming-app-data and follow the README.
Modify the CSV files to your needs and execute the merkle root hash generation. Replace the parameter
`airdropRootHash` in `config/shutterDaoConfig.ts` with the generated value.

### DAO gonvernance parameters
Inside the `config` directory:
- `shutterDAOConfig.ts`

```
  name: 'Shutter DAO',
  // Snapshot | url of the snapshot page
  snapshotURL: '',
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
```

## 3) Deploy DAO


### Set up environment

Requirements: 

- Node.js >=v18

In the root directory execute

```
npm install
```

### Run deployment command

``` 


```



# Test
```
npm run test
```
