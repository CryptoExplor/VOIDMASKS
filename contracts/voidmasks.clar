;; VOIDMASKS - 100% On-Chain Schizocore PFPs
;; SIP-009 Compliant NFT Contract
;; Gas-optimized, permissionless, deterministic

(define-non-fungible-token voidmask uint)

;; Constants
(define-constant MAX-SUPPLY u10000)
(define-constant CONTRACT-OWNER tx-sender)

(define-constant ERR-SOLD-OUT (err u100))
(define-constant ERR-ALREADY-MINTED (err u101))
(define-constant ERR-NOT-OWNER (err u403))
(define-constant ERR-NOT-FOUND (err u404))

;; State
(define-data-var total-supply uint u0)
(define-map minted-wallets principal bool)

;; ========================================
;; SIP-009 REQUIRED FUNCTIONS
;; ========================================

;; Get last token ID
(define-read-only (get-last-token-id)
  (ok (var-get total-supply))
)

;; Get token URI (on-chain SVG)
(define-read-only (get-token-uri (token-id uint))
  (ok (some (concat
    "data:application/json;utf8,"
    "{"
      "\"name\":\"VOIDMASK #"
        (uint-to-ascii token-id)
      "\","
      "\"description\":\"100% on-chain schizocore PFP on Stacks\","
      "\"image\":\"data:image/svg+xml;utf8,"
        (get-svg token-id)
      "\""
    "}"
  )))
)

;; Get owner
(define-read-only (get-owner (token-id uint))
  (ok (nft-get-owner? voidmask token-id))
)

;; Transfer
(define-public (transfer (token-id uint) (sender principal) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender sender) ERR-NOT-OWNER)
    (nft-transfer? voidmask token-id sender recipient)
  )
)

;; ========================================
;; MINT FUNCTION (1 per wallet)
;; ========================================

(define-public (mint)
  (let (
    (supply (var-get total-supply))
    (minter tx-sender)
  )
    ;; Check supply
    (asserts! (< supply MAX-SUPPLY) ERR-SOLD-OUT)
    
    ;; Check if wallet already minted
    (asserts! (is-none (map-get? minted-wallets minter)) ERR-ALREADY-MINTED)
    
    ;; Mint NFT
    (try! (nft-mint? voidmask supply minter))
    
    ;; Update state
    (var-set total-supply (+ supply u1))
    (map-set minted-wallets minter true)
    
    (ok supply)
  )
)

;; ========================================
;; READ-ONLY FUNCTIONS
;; ========================================

;; Check if wallet minted
(define-read-only (has-minted (wallet principal))
  (default-to false (map-get? minted-wallets wallet))
)

;; Get total supply
(define-read-only (get-total-supply)
  (ok (var-get total-supply))
)

;; ========================================
;; ON-CHAIN SVG GENERATION
;; ========================================

(define-read-only (trait (token-id uint) (mod uint))
  (mod token-id mod)
)

(define-read-only (get-svg (token-id uint))
  (let (
    (bg (trait token-id u8))
    (color (trait (/ token-id u8) u8))
    (eyes (trait (/ token-id u64) u4))
    (mouth (trait (/ token-id u256) u4))
    (antenna (trait (/ token-id u1024) u4))
  )
    (concat
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64' shape-rendering='crispEdges'>"
      (bg-layer bg)
      (body-layer color)
      (eyes-layer eyes)
      (mouth-layer mouth)
      (antenna-layer antenna)
      "</svg>"
    )
  )
)

;; SVG Layers
(define-read-only (bg-layer (i uint))
  (if (is-eq i u0) "<rect width='64' height='64' fill='#000'/>"
  (if (is-eq i u1) "<rect width='64' height='64' fill='#111'/>"
  (if (is-eq i u2) "<rect width='64' height='64' fill='#1a1a1a'/>"
  (if (is-eq i u3) "<rect width='64' height='64' fill='#222'/>"
  (if (is-eq i u4) "<rect width='64' height='64' fill='#2a2a2a'/>"
  (if (is-eq i u5) "<rect width='64' height='64' fill='#300'/>"
  (if (is-eq i u6) "<rect width='64' height='64' fill='#003'/>"
    "<rect width='64' height='64' fill='#030'/>"
  )))))))
)

(define-read-only (body-layer (i uint))
  (if (is-eq i u0) "<rect x='16' y='20' width='32' height='28' fill='#fff'/>"
  (if (is-eq i u1) "<rect x='16' y='20' width='32' height='28' fill='#eee'/>"
  (if (is-eq i u2) "<rect x='16' y='20' width='32' height='28' fill='#ccc'/>"
  (if (is-eq i u3) "<rect x='16' y='20' width='32' height='28' fill='#f00'/>"
  (if (is-eq i u4) "<rect x='16' y='20' width='32' height='28' fill='#0f0'/>"
  (if (is-eq i u5) "<rect x='16' y='20' width='32' height='28' fill='#00f'/>"
  (if (is-eq i u6) "<rect x='16' y='20' width='32' height='28' fill='#ff0'/>"
    "<rect x='16' y='20' width='32' height='28' fill='#f0f'/>"
  )))))))
)

(define-read-only (eyes-layer (i uint))
  (if (is-eq i u0) "<rect x='22' y='28' width='4' height='4'/><rect x='38' y='28' width='4' height='4'/>"
  (if (is-eq i u1) "<rect x='22' y='28' width='4' height='2'/><rect x='38' y='28' width='4' height='2'/>"
  (if (is-eq i u2) "<rect x='22' y='28' width='4' height='4' fill='#f00'/><rect x='38' y='28' width='4' height='4' fill='#f00'/>"
    "<rect x='22' y='28' width='2' height='4'/><rect x='38' y='28' width='2' height='4'/>"
  )))
)

(define-read-only (mouth-layer (i uint))
  (if (is-eq i u0) ""
  (if (is-eq i u1) "<rect x='28' y='36' width='8' height='2'/>"
  (if (is-eq i u2) "<rect x='26' y='36' width='12' height='4'/>"
    "<rect x='30' y='36' width='4' height='6'/>"
  )))
)

(define-read-only (antenna-layer (i uint))
  (if (is-eq i u0) ""
  (if (is-eq i u1) "<rect x='31' y='10' width='2' height='10'/>"
  (if (is-eq i u2) "<rect x='20' y='12' width='2' height='8'/><rect x='42' y='12' width='2' height='8'/>"
    "<rect x='31' y='8' width='2' height='12'/>"
  )))
)

;; Helper: uint to ascii
(define-read-only (uint-to-ascii (value uint))
  (if (<= value u9)
    (unwrap-panic (element-at "0123456789" value))
    (get r (fold uint-to-ascii-iter 
      0x00000000000000000000000000000000000000000000000000000000000000000000000000000000
      {v: value, r: ""}))
  )
)

(define-private (uint-to-ascii-iter (i (buff 1)) (d {v: uint, r: (string-ascii 40)}))
  (if (> (get v d) u0)
    {
      v: (/ (get v d) u10),
      r: (unwrap-panic (as-max-len? 
        (concat (unwrap-panic (element-at "0123456789" (mod (get v d) u10))) (get r d))
        u40))
    }
    d
  )
)