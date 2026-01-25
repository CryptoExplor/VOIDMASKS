;; =====================================================
;; VOIDMASKS — Clarity 4 NFT Contract (FINAL)
;; 100% On-chain SVG • Deterministic • Permissionless
;; =====================================================

;; -----------------------------------------------------
;; NFT Definition
;; -----------------------------------------------------

(define-non-fungible-token voidmask uint)

(define-constant MAX-SUPPLY u10000)

;; -----------------------------------------------------
;; Storage
;; -----------------------------------------------------

(define-data-var total-supply uint u0)

;; Enforce 1 NFT per wallet (hard rule)
(define-map minted
  { owner: principal }
  { minted: bool }
)

;; -----------------------------------------------------
;; Read-only helpers (USED BY FRONTEND / EXPLORERS)
;; -----------------------------------------------------

(define-read-only (total-supply)
  (var-get total-supply)
)

(define-read-only (get-last-token-id)
  (var-get total-supply)
)

(define-read-only (get-owner (token-id uint))
  (nft-get-owner? voidmask token-id)
)

(define-read-only (balance-of (owner principal))
  (if (is-some (map-get? minted { owner: owner }))
      u1
      u0
  )
)

;; -----------------------------------------------------
;; Mint (FREE, GAS ONLY)
;; -----------------------------------------------------

(define-public (mint)
  (let (
        (sender tx-sender)
        (supply (var-get total-supply))
        (next-id (+ supply u1))
       )
    (begin
      ;; Supply cap
      (asserts! (< supply MAX-SUPPLY) (err u100))

      ;; One NFT per wallet
      (asserts!
        (is-none (map-get? minted { owner: sender }))
        (err u101)
      )

      ;; Mint
      (try! (nft-mint? voidmask next-id sender))

      ;; Mark minted
      (map-set minted { owner: sender } { minted: true })

      ;; Update supply
      (var-set total-supply next-id)

      (ok next-id)
    )
  )
)

;; -----------------------------------------------------
;; SIP-009 Transfer
;; -----------------------------------------------------

(define-public (transfer (token-id uint) (sender principal) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender sender) (err u403))
    (nft-transfer? voidmask token-id sender recipient)
  )
)

;; -----------------------------------------------------
;; Metadata (ON-CHAIN, SVG DATA URI)
;; -----------------------------------------------------
;; NOTE:
;; We intentionally DO NOT stringify uints in Clarity.
;; Token ID display is handled by the frontend.
;; This avoids recursion, folds, and gas traps.
;; -----------------------------------------------------

(define-read-only (get-token-uri (token-id uint))
  (ok
    (concat
      "data:application/json;utf8,{"
        "\"name\":\"VOIDMASK\","
        "\"description\":\"100% on-chain schizocore PFP on Stacks.\","
        "\"image\":\"data:image/svg+xml;utf8,"
        (get-svg token-id)
      "\"}"
    )
  )
)

;; -----------------------------------------------------
;; Deterministic Trait Math
;; -----------------------------------------------------

(define-read-only (trait (token-id uint) (m uint))
  (mod token-id m)
)

;; -----------------------------------------------------
;; Trait API (Explorer / UI Friendly)
;; -----------------------------------------------------

(define-read-only (get-traits (token-id uint))
  (let (
        (bg (trait token-id u8))
        (eyes (trait (/ token-id u8) u4))
        (mouth (trait (/ token-id u32) u4))
       )
    (ok {
      bg-index: bg,
      eyes-index: eyes,
      mouth-index: mouth
    })
  )
)

;; -----------------------------------------------------
;; SVG Generator (GAS-OPTIMIZED)
;; -----------------------------------------------------

(define-read-only (get-svg (token-id uint))
  (let (
        (bg (trait token-id u8))
        (eyes (trait (/ token-id u8) u4))
        (mouth (trait (/ token-id u32) u4))
       )
    (concat
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64' shape-rendering='crispEdges'>"
      (bg-layer bg)
      "<rect x='16' y='20' width='32' height='28' fill='#eee'/>"
      (eyes-layer eyes)
      (mouth-layer mouth)
      "</svg>"
    )
  )
)

;; -----------------------------------------------------
;; SVG Layers
;; -----------------------------------------------------

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

(define-read-only (eyes-layer (i uint))
  (if (is-eq i u0)
      "<rect x='22' y='28' width='4' height='4'/><rect x='38' y='28' width='4' height='4'/>"
  (if (is-eq i u1)
      "<rect x='22' y='28' width='4' height='2'/><rect x='38' y='28' width='4' height='2'/>"
  (if (is-eq i u2)
      "<rect x='22' y='28' width='4' height='4' fill='#f00'/><rect x='38' y='28' width='4' height='4' fill='#f00'/>"
      "<rect x='30' y='28' width='2' height='4'/>"
  )))
)

(define-read-only (mouth-layer (i uint))
  (if (is-eq i u0) ""
  (if (is-eq i u1)
      "<rect x='28' y='36' width='8' height='2'/>"
  (if (is-eq i u2)
      "<rect x='26' y='36' width='12' height='4'/>"
      "<rect x='30' y='36' width='4' height='6'/>"
  )))
)
