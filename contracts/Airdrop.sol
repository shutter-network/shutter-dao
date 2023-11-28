// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0 <0.9.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "./VestingPoolManager.sol";
import "./ShutterToken.sol";

/// @title Airdrop contract
/// original contract: https://github.com/safe-global/safe-token/blob/main/contracts/Airdrop.sol
/// @author Daniel Dimitrov - @compojoom, Fred Lührs - @fredo
contract Airdrop {
    event RedeemedVesting(bytes32 indexed id, address indexed user);

    // Root of the Merkle tree
    bytes32 public root;
    // Time until which the airdrop can be redeemed
    uint64 public immutable redeemDeadline;

    // Instance of the VestingPoolManager contract
    VestingPoolManager public vestingPoolManager;
    // Instance of the ShutterToken contract
    ShutterToken public immutable token;
    // Address of the airdrop manager
    address public immutable airdropManager;

    modifier onlyAirdropManager() {
        require(msg.sender == airdropManager, "Can only be called by pool manager");
        _;
    }

    /// @notice Creates the airdrop for the token at address `_token` and `_manager` as the manager. The airdrop can be redeemed until `_redeemDeadline`.
    /// @param _token The token that should be used for the airdrop
    /// @param _manager The manager of this airdrop (e.g. the address that can call `initializeRoot`)
    /// @param _redeemDeadline The deadline until when the airdrop could be redeemed (if inititalized). This needs to be a date in the future.
    constructor(
        address _token,
        address _manager,
        uint64 _redeemDeadline,
        VestingPoolManager _vestingPoolManager
    ) {
        require(_redeemDeadline > block.timestamp, "Redeem deadline should be in the future");
        redeemDeadline = _redeemDeadline;
        token = ShutterToken(_token);
        airdropManager = _manager;
        vestingPoolManager = _vestingPoolManager;
    }

    /// @notice Initialize the airdrop with `_root` as the Merkle root.
    /// @dev This can only be called once
    /// @param _root The Merkle root that should be set for this contract
    function initializeRoot(bytes32 _root) public onlyAirdropManager {
        require(root == bytes32(0), "State root already initialized");
        root = _root;
    }

    /// @notice Creates a vesting authorized by the Merkle proof.
    /// @dev It is required that the pool has enough tokens available
    /// @dev Vesting will be created for msg.sender
    /// @param curveType Type of the curve that should be used for the vesting
    /// @param durationWeeks The duration of the vesting in weeks
    /// @param startDate The date when the vesting should be started (can be in the past)
    /// @param amount Amount of tokens that should be vested in atoms
    /// @param proof Proof to redeem tokens
    function redeem(
        uint8 curveType,
        uint16 durationWeeks,
        uint64 startDate,
        uint128 amount,
        bytes32[] calldata proof
    ) external {
        require(block.timestamp <= redeemDeadline, "Deadline to redeem vesting has been exceeded");
        require(root != bytes32(0), "State root not initialized");

        address spender = address(vestingPoolManager);

        if (token.paused()) {
            spender = airdropManager;
        }

        token.approve(spender, amount);
        bytes32 vestingId = vestingPoolManager.addVesting(msg.sender, curveType, false, durationWeeks, startDate, amount, 0);

        emit RedeemedVesting(vestingId, msg.sender);

        // This call will fail if the vesting was already created
        require(MerkleProof.verify(proof, root, vestingId), "Invalid merkle proof");
    }

    /// @notice Claims all tokens that have not been redeemed before `redeemDeadline`
    /// @dev Can only be called after `redeemDeadline` has been reached.
    /// @param beneficiary Account that should receive the claimed tokens
    function claimUnusedTokens(address beneficiary) external onlyAirdropManager {
        require(block.timestamp > redeemDeadline, "Tokens can still be redeemed");
        uint256 unusedTokens = token.balanceOf(address(this));
        require(unusedTokens > 0, "No tokens to claim");
        require(token.transfer(beneficiary, unusedTokens), "Token transfer failed");
    }

}
