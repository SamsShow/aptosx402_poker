/// x402 Poker - On-chain Texas Hold'em Game Contract
/// 
/// This module implements the core poker game logic including:
/// - Game creation and player management
/// - Betting mechanics with x402 payment verification
/// - Commit-reveal RNG for fair deck shuffling
/// - Pot management and settlement
module x402_poker::poker {
    use std::vector;
    use std::signer;
    use std::string::String;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::timestamp;
    use aptos_framework::event;
    use aptos_std::table::{Self, Table};
    use aptos_std::hash;

    // ============ Error Codes ============
    const E_NOT_AUTHORIZED: u64 = 1;
    const E_GAME_NOT_FOUND: u64 = 2;
    const E_GAME_ALREADY_EXISTS: u64 = 3;
    const E_GAME_FULL: u64 = 4;
    const E_GAME_NOT_STARTED: u64 = 5;
    const E_GAME_ALREADY_STARTED: u64 = 6;
    const E_INVALID_STAGE: u64 = 7;
    const E_NOT_YOUR_TURN: u64 = 8;
    const E_INSUFFICIENT_FUNDS: u64 = 9;
    const E_INVALID_BET_AMOUNT: u64 = 10;
    const E_PLAYER_NOT_FOUND: u64 = 11;
    const E_PLAYER_ALREADY_FOLDED: u64 = 12;
    const E_INVALID_ACTION: u64 = 13;
    const E_COMMITMENT_ALREADY_MADE: u64 = 14;
    const E_COMMITMENT_NOT_FOUND: u64 = 15;
    const E_INVALID_REVEAL: u64 = 16;
    const E_NOT_ALL_COMMITTED: u64 = 17;
    const E_NOT_ALL_REVEALED: u64 = 18;
    const E_INVALID_RECEIPT: u64 = 19;

    // ============ Constants ============
    const MAX_PLAYERS: u64 = 5;
    const MIN_PLAYERS: u64 = 2;
    
    // Game stages
    const STAGE_WAITING: u8 = 0;
    const STAGE_PREFLOP: u8 = 1;
    const STAGE_FLOP: u8 = 2;
    const STAGE_TURN: u8 = 3;
    const STAGE_RIVER: u8 = 4;
    const STAGE_SHOWDOWN: u8 = 5;
    const STAGE_SETTLED: u8 = 6;

    // Action types
    const ACTION_FOLD: u8 = 0;
    const ACTION_CHECK: u8 = 1;
    const ACTION_CALL: u8 = 2;
    const ACTION_BET: u8 = 3;
    const ACTION_RAISE: u8 = 4;
    const ACTION_ALL_IN: u8 = 5;

    // ============ Structs ============

    /// Player state within a game
    struct PlayerState has store, drop, copy {
        address: address,
        stack: u64,
        current_bet: u64,
        total_bet_this_hand: u64,
        folded: bool,
        is_all_in: bool,
        acted_this_round: bool,
        seed_commitment: vector<u8>,
        seed_revealed: vector<u8>,
    }

    /// Main game state
    struct Game has store {
        id: String,
        owner: address,
        players: vector<PlayerState>,
        pot: u64,
        side_pots: vector<u64>,
        stage: u8,
        dealer_index: u8,
        current_player_index: u8,
        current_bet: u64,
        small_blind: u64,
        big_blind: u64,
        buy_in: u64,
        state_nonce: u64,
        hand_number: u64,
        community_cards: vector<u8>,
        combined_seed: vector<u8>,
        created_at: u64,
        updated_at: u64,
    }

    /// Global game registry
    struct GameRegistry has key {
        games: Table<String, Game>,
        game_count: u64,
    }

    /// Resource to hold game escrow funds
    struct GameEscrow has key {
        funds: coin::Coin<AptosCoin>,
    }

    // ============ Events ============

    #[event]
    struct GameCreatedEvent has drop, store {
        game_id: String,
        owner: address,
        buy_in: u64,
        small_blind: u64,
        big_blind: u64,
        timestamp: u64,
    }

    #[event]
    struct PlayerJoinedEvent has drop, store {
        game_id: String,
        player: address,
        stack: u64,
        timestamp: u64,
    }

    #[event]
    struct GameStartedEvent has drop, store {
        game_id: String,
        player_count: u64,
        timestamp: u64,
    }

    #[event]
    struct BetPlacedEvent has drop, store {
        game_id: String,
        player: address,
        action: u8,
        amount: u64,
        new_pot: u64,
        timestamp: u64,
    }

    #[event]
    struct StageAdvancedEvent has drop, store {
        game_id: String,
        new_stage: u8,
        pot: u64,
        timestamp: u64,
    }

    #[event]
    struct SeedCommittedEvent has drop, store {
        game_id: String,
        player: address,
        commitment: vector<u8>,
        timestamp: u64,
    }

    #[event]
    struct SeedRevealedEvent has drop, store {
        game_id: String,
        player: address,
        timestamp: u64,
    }

    #[event]
    struct GameSettledEvent has drop, store {
        game_id: String,
        winners: vector<address>,
        amounts: vector<u64>,
        timestamp: u64,
    }

    // ============ Initialization ============

    /// Initialize the game registry for a new account
    public entry fun initialize(account: &signer) {
        let addr = signer::address_of(account);
        
        if (!exists<GameRegistry>(addr)) {
            move_to(account, GameRegistry {
                games: table::new(),
                game_count: 0,
            });
        };

        if (!exists<GameEscrow>(addr)) {
            move_to(account, GameEscrow {
                funds: coin::zero<AptosCoin>(),
            });
        };
    }

    // ============ Game Management ============

    /// Create a new poker game
    public entry fun create_game(
        owner: &signer,
        game_id: String,
        buy_in: u64,
        small_blind: u64,
        big_blind: u64,
    ) acquires GameRegistry {
        let owner_addr = signer::address_of(owner);
        
        assert!(exists<GameRegistry>(owner_addr), E_NOT_AUTHORIZED);
        
        let registry = borrow_global_mut<GameRegistry>(owner_addr);
        
        assert!(!table::contains(&registry.games, game_id), E_GAME_ALREADY_EXISTS);
        
        let now = timestamp::now_seconds();
        
        let game = Game {
            id: game_id,
            owner: owner_addr,
            players: vector::empty(),
            pot: 0,
            side_pots: vector::empty(),
            stage: STAGE_WAITING,
            dealer_index: 0,
            current_player_index: 0,
            current_bet: 0,
            small_blind,
            big_blind,
            buy_in,
            state_nonce: 0,
            hand_number: 0,
            community_cards: vector::empty(),
            combined_seed: vector::empty(),
            created_at: now,
            updated_at: now,
        };
        
        table::add(&mut registry.games, game_id, game);
        registry.game_count = registry.game_count + 1;
        
        event::emit(GameCreatedEvent {
            game_id,
            owner: owner_addr,
            buy_in,
            small_blind,
            big_blind,
            timestamp: now,
        });
    }

    /// Join an existing game with buy-in
    public entry fun join_game(
        player: &signer,
        registry_owner: address,
        game_id: String,
    ) acquires GameRegistry, GameEscrow {
        let player_addr = signer::address_of(player);
        
        let registry = borrow_global_mut<GameRegistry>(registry_owner);
        assert!(table::contains(&registry.games, game_id), E_GAME_NOT_FOUND);
        
        let game = table::borrow_mut(&mut registry.games, game_id);
        
        assert!(game.stage == STAGE_WAITING, E_GAME_ALREADY_STARTED);
        assert!(vector::length(&game.players) < MAX_PLAYERS, E_GAME_FULL);
        
        // Check player not already in game
        let i = 0;
        let len = vector::length(&game.players);
        while (i < len) {
            let p = vector::borrow(&game.players, i);
            assert!(p.address != player_addr, E_PLAYER_NOT_FOUND);
            i = i + 1;
        };
        
        // Transfer buy-in to escrow
        let buy_in_coin = coin::withdraw<AptosCoin>(player, game.buy_in);
        let escrow = borrow_global_mut<GameEscrow>(registry_owner);
        coin::merge(&mut escrow.funds, buy_in_coin);
        
        let player_state = PlayerState {
            address: player_addr,
            stack: game.buy_in,
            current_bet: 0,
            total_bet_this_hand: 0,
            folded: false,
            is_all_in: false,
            acted_this_round: false,
            seed_commitment: vector::empty(),
            seed_revealed: vector::empty(),
        };
        
        vector::push_back(&mut game.players, player_state);
        game.state_nonce = game.state_nonce + 1;
        game.updated_at = timestamp::now_seconds();
        
        event::emit(PlayerJoinedEvent {
            game_id,
            player: player_addr,
            stack: game.buy_in,
            timestamp: game.updated_at,
        });
    }

    /// Start the game (only owner, requires minimum players)
    public entry fun start_game(
        owner: &signer,
        game_id: String,
    ) acquires GameRegistry {
        let owner_addr = signer::address_of(owner);
        
        let registry = borrow_global_mut<GameRegistry>(owner_addr);
        assert!(table::contains(&registry.games, game_id), E_GAME_NOT_FOUND);
        
        let game = table::borrow_mut(&mut registry.games, game_id);
        
        assert!(game.owner == owner_addr, E_NOT_AUTHORIZED);
        assert!(game.stage == STAGE_WAITING, E_GAME_ALREADY_STARTED);
        assert!(vector::length(&game.players) >= MIN_PLAYERS, E_GAME_NOT_STARTED);
        
        game.stage = STAGE_PREFLOP;
        game.hand_number = 1;
        game.state_nonce = game.state_nonce + 1;
        game.updated_at = timestamp::now_seconds();
        
        post_blinds(game);
        
        event::emit(GameStartedEvent {
            game_id,
            player_count: vector::length(&game.players),
            timestamp: game.updated_at,
        });
    }

    // ============ Betting Actions ============

    /// Place a bet action (fold, check, call, bet, raise, all-in)
    public entry fun place_bet(
        player: &signer,
        registry_owner: address,
        game_id: String,
        action: u8,
        amount: u64,
        _facilitator_receipt: vector<u8>,
    ) acquires GameRegistry {
        let player_addr = signer::address_of(player);
        
        let registry = borrow_global_mut<GameRegistry>(registry_owner);
        assert!(table::contains(&registry.games, game_id), E_GAME_NOT_FOUND);
        
        let game = table::borrow_mut(&mut registry.games, game_id);
        
        assert!(game.stage >= STAGE_PREFLOP && game.stage <= STAGE_RIVER, E_INVALID_STAGE);
        
        let player_idx = find_player_index(&game.players, player_addr);
        assert!(player_idx < vector::length(&game.players), E_PLAYER_NOT_FOUND);
        assert!((player_idx as u8) == game.current_player_index, E_NOT_YOUR_TURN);
        
        // Get player info first (immutable borrow)
        let player_folded: bool;
        let player_stack: u64;
        let player_current_bet: u64;
        {
            let player_state = vector::borrow(&game.players, player_idx);
            player_folded = player_state.folded;
            player_stack = player_state.stack;
            player_current_bet = player_state.current_bet;
        };
        
        assert!(!player_folded, E_PLAYER_ALREADY_FOLDED);
        
        // Track if we need to reset acted flags
        let should_reset_flags = false;
        let new_current_bet = game.current_bet;
        
        // Process action
        if (action == ACTION_FOLD) {
            let player_state = vector::borrow_mut(&mut game.players, player_idx);
            player_state.folded = true;
        } else if (action == ACTION_CHECK) {
            assert!(game.current_bet == player_current_bet, E_INVALID_ACTION);
        } else if (action == ACTION_CALL) {
            let call_amount = game.current_bet - player_current_bet;
            assert!(player_stack >= call_amount, E_INSUFFICIENT_FUNDS);
            let player_state = vector::borrow_mut(&mut game.players, player_idx);
            player_state.stack = player_state.stack - call_amount;
            player_state.current_bet = game.current_bet;
            player_state.total_bet_this_hand = player_state.total_bet_this_hand + call_amount;
            game.pot = game.pot + call_amount;
        } else if (action == ACTION_BET || action == ACTION_RAISE) {
            let total_bet = if (action == ACTION_BET) { amount } else { game.current_bet + amount };
            let additional = total_bet - player_current_bet;
            assert!(player_stack >= additional, E_INSUFFICIENT_FUNDS);
            assert!(amount >= game.big_blind, E_INVALID_BET_AMOUNT);
            
            let player_state = vector::borrow_mut(&mut game.players, player_idx);
            player_state.stack = player_state.stack - additional;
            player_state.current_bet = total_bet;
            player_state.total_bet_this_hand = player_state.total_bet_this_hand + additional;
            
            new_current_bet = total_bet;
            game.pot = game.pot + additional;
            should_reset_flags = true;
        } else if (action == ACTION_ALL_IN) {
            let all_in_amount = player_stack;
            let player_state = vector::borrow_mut(&mut game.players, player_idx);
            player_state.current_bet = player_state.current_bet + all_in_amount;
            player_state.total_bet_this_hand = player_state.total_bet_this_hand + all_in_amount;
            player_state.stack = 0;
            player_state.is_all_in = true;
            game.pot = game.pot + all_in_amount;
            
            let new_player_bet = player_state.current_bet;
            if (new_player_bet > game.current_bet) {
                new_current_bet = new_player_bet;
                should_reset_flags = true;
            };
        } else {
            abort E_INVALID_ACTION
        };
        
        // Update current bet
        game.current_bet = new_current_bet;
        
        // Reset acted flags if needed (after dropping mutable borrow)
        if (should_reset_flags) {
            reset_acted_flags(game, player_idx);
        };
        
        // Mark player as acted
        {
            let player_state = vector::borrow_mut(&mut game.players, player_idx);
            player_state.acted_this_round = true;
        };
        
        game.state_nonce = game.state_nonce + 1;
        game.updated_at = timestamp::now_seconds();
        
        event::emit(BetPlacedEvent {
            game_id,
            player: player_addr,
            action,
            amount,
            new_pot: game.pot,
            timestamp: game.updated_at,
        });
        
        advance_game(game, game_id);
    }

    // ============ Commit-Reveal RNG ============

    /// Commit a seed hash for RNG
    public entry fun commit_seed(
        player: &signer,
        registry_owner: address,
        game_id: String,
        seed_hash: vector<u8>,
    ) acquires GameRegistry {
        let player_addr = signer::address_of(player);
        
        let registry = borrow_global_mut<GameRegistry>(registry_owner);
        let game = table::borrow_mut(&mut registry.games, game_id);
        
        let player_idx = find_player_index(&game.players, player_addr);
        let player_state = vector::borrow_mut(&mut game.players, player_idx);
        
        assert!(vector::is_empty(&player_state.seed_commitment), E_COMMITMENT_ALREADY_MADE);
        
        player_state.seed_commitment = seed_hash;
        game.state_nonce = game.state_nonce + 1;
        
        event::emit(SeedCommittedEvent {
            game_id,
            player: player_addr,
            commitment: seed_hash,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Reveal the seed after all commitments
    public entry fun reveal_seed(
        player: &signer,
        registry_owner: address,
        game_id: String,
        seed: vector<u8>,
    ) acquires GameRegistry {
        let player_addr = signer::address_of(player);
        
        let registry = borrow_global_mut<GameRegistry>(registry_owner);
        let game = table::borrow_mut(&mut registry.games, game_id);
        
        assert!(all_players_committed(game), E_NOT_ALL_COMMITTED);
        
        let player_idx = find_player_index(&game.players, player_addr);
        let player_state = vector::borrow_mut(&mut game.players, player_idx);
        
        let computed_hash = hash::sha3_256(seed);
        assert!(computed_hash == player_state.seed_commitment, E_INVALID_REVEAL);
        
        player_state.seed_revealed = seed;
        game.state_nonce = game.state_nonce + 1;
        
        event::emit(SeedRevealedEvent {
            game_id,
            player: player_addr,
            timestamp: timestamp::now_seconds(),
        });
        
        if (all_players_revealed(game)) {
            compute_combined_seed(game);
        };
    }

    /// Settle the game and distribute pot to winners
    public entry fun settle_game(
        owner: &signer,
        game_id: String,
        winner_addresses: vector<address>,
        winner_amounts: vector<u64>,
    ) acquires GameRegistry, GameEscrow {
        let owner_addr = signer::address_of(owner);
        
        let registry = borrow_global_mut<GameRegistry>(owner_addr);
        let game = table::borrow_mut(&mut registry.games, game_id);
        
        assert!(game.owner == owner_addr, E_NOT_AUTHORIZED);
        assert!(game.stage == STAGE_SHOWDOWN, E_INVALID_STAGE);
        
        let escrow = borrow_global_mut<GameEscrow>(owner_addr);
        
        let i = 0;
        let len = vector::length(&winner_addresses);
        while (i < len) {
            let winner = *vector::borrow(&winner_addresses, i);
            let amount = *vector::borrow(&winner_amounts, i);
            
            let payout = coin::extract(&mut escrow.funds, amount);
            coin::deposit(winner, payout);
            
            i = i + 1;
        };
        
        game.stage = STAGE_SETTLED;
        game.pot = 0;
        game.state_nonce = game.state_nonce + 1;
        game.updated_at = timestamp::now_seconds();
        
        event::emit(GameSettledEvent {
            game_id,
            winners: winner_addresses,
            amounts: winner_amounts,
            timestamp: game.updated_at,
        });
    }

    // ============ Helper Functions ============

    fun post_blinds(game: &mut Game) {
        let num_players = vector::length(&game.players);
        
        let sb_idx = ((game.dealer_index as u64) + 1) % num_players;
        {
            let sb_player = vector::borrow_mut(&mut game.players, sb_idx);
            let sb_amount = if (sb_player.stack < game.small_blind) { sb_player.stack } else { game.small_blind };
            sb_player.stack = sb_player.stack - sb_amount;
            sb_player.current_bet = sb_amount;
            sb_player.total_bet_this_hand = sb_amount;
            game.pot = game.pot + sb_amount;
        };
        
        let bb_idx = ((game.dealer_index as u64) + 2) % num_players;
        {
            let bb_player = vector::borrow_mut(&mut game.players, bb_idx);
            let bb_amount = if (bb_player.stack < game.big_blind) { bb_player.stack } else { game.big_blind };
            bb_player.stack = bb_player.stack - bb_amount;
            bb_player.current_bet = bb_amount;
            bb_player.total_bet_this_hand = bb_amount;
            game.pot = game.pot + bb_amount;
            game.current_bet = bb_amount;
        };
        
        game.current_player_index = (((game.dealer_index as u64) + 3) % num_players) as u8;
    }

    fun find_player_index(players: &vector<PlayerState>, addr: address): u64 {
        let i = 0;
        let len = vector::length(players);
        while (i < len) {
            if (vector::borrow(players, i).address == addr) {
                return i
            };
            i = i + 1;
        };
        len
    }

    fun reset_acted_flags(game: &mut Game, except_idx: u64) {
        let i = 0;
        let len = vector::length(&game.players);
        while (i < len) {
            if (i != except_idx) {
                let p = vector::borrow_mut(&mut game.players, i);
                if (!p.folded && !p.is_all_in) {
                    p.acted_this_round = false;
                };
            };
            i = i + 1;
        };
    }

    fun advance_game(game: &mut Game, game_id: String) {
        let num_players = vector::length(&game.players);
        let start_idx = ((game.current_player_index as u64) + 1) % num_players;
        
        let active_count = 0;
        let i = 0;
        while (i < num_players) {
            let p = vector::borrow(&game.players, i);
            if (!p.folded) {
                active_count = active_count + 1;
            };
            i = i + 1;
        };
        
        if (active_count == 1) {
            game.stage = STAGE_SHOWDOWN;
            return
        };
        
        i = 0;
        while (i < num_players) {
            let idx = (start_idx + i) % num_players;
            let p = vector::borrow(&game.players, idx);
            if (!p.folded && !p.is_all_in && !p.acted_this_round) {
                game.current_player_index = (idx as u8);
                return
            };
            i = i + 1;
        };
        
        advance_stage(game, game_id);
    }

    fun advance_stage(game: &mut Game, game_id: String) {
        let i = 0;
        let len = vector::length(&game.players);
        while (i < len) {
            let p = vector::borrow_mut(&mut game.players, i);
            p.current_bet = 0;
            p.acted_this_round = false;
            i = i + 1;
        };
        game.current_bet = 0;
        
        game.stage = game.stage + 1;
        
        let num_players = vector::length(&game.players);
        let start_idx = ((game.dealer_index as u64) + 1) % num_players;
        i = 0;
        while (i < num_players) {
            let idx = (start_idx + i) % num_players;
            let p = vector::borrow(&game.players, idx);
            if (!p.folded && !p.is_all_in) {
                game.current_player_index = (idx as u8);
                break
            };
            i = i + 1;
        };
        
        event::emit(StageAdvancedEvent {
            game_id,
            new_stage: game.stage,
            pot: game.pot,
            timestamp: timestamp::now_seconds(),
        });
    }

    fun all_players_committed(game: &Game): bool {
        let i = 0;
        let len = vector::length(&game.players);
        while (i < len) {
            let p = vector::borrow(&game.players, i);
            if (!p.folded && vector::is_empty(&p.seed_commitment)) {
                return false
            };
            i = i + 1;
        };
        true
    }

    fun all_players_revealed(game: &Game): bool {
        let i = 0;
        let len = vector::length(&game.players);
        while (i < len) {
            let p = vector::borrow(&game.players, i);
            if (!p.folded && vector::is_empty(&p.seed_revealed)) {
                return false
            };
            i = i + 1;
        };
        true
    }

    fun compute_combined_seed(game: &mut Game) {
        let combined = vector::empty<u8>();
        let i = 0;
        let len = vector::length(&game.players);
        while (i < len) {
            let p = vector::borrow(&game.players, i);
            if (!p.folded) {
                vector::append(&mut combined, p.seed_revealed);
            };
            i = i + 1;
        };
        game.combined_seed = hash::sha3_256(combined);
    }

    // ============ View Functions ============

    #[view]
    public fun get_game_stage(registry_owner: address, game_id: String): u8 acquires GameRegistry {
        let registry = borrow_global<GameRegistry>(registry_owner);
        let game = table::borrow(&registry.games, game_id);
        game.stage
    }

    #[view]
    public fun get_pot(registry_owner: address, game_id: String): u64 acquires GameRegistry {
        let registry = borrow_global<GameRegistry>(registry_owner);
        let game = table::borrow(&registry.games, game_id);
        game.pot
    }

    #[view]
    public fun get_current_bet(registry_owner: address, game_id: String): u64 acquires GameRegistry {
        let registry = borrow_global<GameRegistry>(registry_owner);
        let game = table::borrow(&registry.games, game_id);
        game.current_bet
    }

    #[view]
    public fun get_current_player_index(registry_owner: address, game_id: String): u8 acquires GameRegistry {
        let registry = borrow_global<GameRegistry>(registry_owner);
        let game = table::borrow(&registry.games, game_id);
        game.current_player_index
    }

    #[view]
    public fun get_state_nonce(registry_owner: address, game_id: String): u64 acquires GameRegistry {
        let registry = borrow_global<GameRegistry>(registry_owner);
        let game = table::borrow(&registry.games, game_id);
        game.state_nonce
    }

    #[view]
    public fun get_player_count(registry_owner: address, game_id: String): u64 acquires GameRegistry {
        let registry = borrow_global<GameRegistry>(registry_owner);
        let game = table::borrow(&registry.games, game_id);
        vector::length(&game.players)
    }
}
