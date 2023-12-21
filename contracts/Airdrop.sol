// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.22 <0.9.0;

import { MerkleProof } from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import { VestingPoolManager } from "./VestingPoolManager.sol";
import { ShutterToken } from "./ShutterToken.sol";

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
        require(
            msg.sender == airdropManager,
            "Can only be called by pool manager"
        );
        _;
    }

    /// @notice Creates the airdrop for the token at address `_token` and `_manager` as the manager. The airdrop can be redeemed until `_redeemDeadline`.
    /// @param _token The token that should be used for the airdrop
    /// @param _manager The manager of this airdrop (e.g. the address that can call `initializeRoot`)
    /// @param _redeemDeadline The deadline until when the airdrop could be redeemed (if initialized). This needs to be a date in the future.
    /// @param _vestingPoolManager The address of the VestingPoolManager contract
    /// @param _root The Merkle root of the merkle drop
    constructor(
        address _token,
        address _manager,
        uint64 _redeemDeadline,
        address _vestingPoolManager,
        bytes32 _root
    ) {
        require(
            _redeemDeadline > block.timestamp,
            "Redeem deadline should be in the future"
        );
        require(_root != bytes32(0), "State root should be set");
        redeemDeadline = _redeemDeadline;
        token = ShutterToken(_token);
        airdropManager = _manager;
        vestingPoolManager = VestingPoolManager(_vestingPoolManager);
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
        uint128 initialUnlock,
        bytes32[] calldata proof,
        bool requiresSPT
    ) public virtual {
        require(
            block.timestamp <= redeemDeadline,
            "Deadline to redeem vesting has been exceeded"
        );

        address spender = address(vestingPoolManager);

        if (token.paused()) {
            spender = airdropManager;
        }

        token.approve(spender, amount);
        // This call will fail if the vesting was already created
        bytes32 vestingId = vestingPoolManager.addVesting(
            msg.sender,
            curveType,
            false,
            durationWeeks,
            startDate,
            amount,
            initialUnlock,
            requiresSPT
        );

        emit RedeemedVesting(vestingId, msg.sender);

        // fail if the vestingId is not in the merkle root
        require(
            MerkleProof.verify(proof, root, vestingId),
            "Invalid merkle proof"
        );
    }

    /// @notice Claims all tokens that have not been redeemed before `redeemDeadline`
    /// @dev Can only be called after `redeemDeadline` has been reached.
    /// @param beneficiary Account that should receive the claimed tokens
    function claimUnusedTokens(
        address beneficiary
    ) external onlyAirdropManager {
        require(
            block.timestamp > redeemDeadline,
            "Tokens can still be redeemed"
        );
        uint256 unusedTokens = token.balanceOf(address(this));
        require(unusedTokens > 0, "No tokens to claim");
        require(
            token.transfer(beneficiary, unusedTokens),
            "Token transfer failed"
        );
    }
}
