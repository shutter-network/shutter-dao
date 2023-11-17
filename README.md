# Shutter DAO template

This template is modified version of the [Decent DAO](https://github.com/decent-dao/dcnt) and
[safe DAO](https://github.com/safe-global/safe-token)

### Configuration
Inside the `config` directory:
- `shutterDAOConfig.ts` - set configuration values for Shutter Token and Shutter DAO.

### Deploy
Exact steps to be determined

```
nvm use
npx hardhat compile

// Currently supported networks are goerli + mainnet.
npx hardhat run --network <network> scripts/deploy.ts
```

# Test
```
npm run test
```
