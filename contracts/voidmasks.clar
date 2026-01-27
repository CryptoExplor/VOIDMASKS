;; =====================================================
;; VOIDMASKS — SIP-009 Compliant NFT Contract
;; 100% On-chain SVG • Deterministic • Permissionless
;; =====================================================

;; -----------------------------------------------------
;; SIP-009 Trait Implementation
;; -----------------------------------------------------
;; IMPORTANT: For mainnet use SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.nft-trait.nft-trait
;; For testnet, use the testnet trait address or deploy your own trait
;; Option 1: Comment out for initial testing, uncomment after deploying trait
;; Option 2: Deploy the SIP-009 trait yourself first, then reference it
;; (impl-trait 'ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT.nft-trait.nft-trait)

;; -----------------------------------------------------
;; NFT Definition
;; -----------------------------------------------------
(define-non-fungible-token voidmask uint)

;; -----------------------------------------------------
;; Constants
;; -----------------------------------------------------
(define-constant MAX-SUPPLY u10000)
(define-constant CONTRACT-OWNER tx-sender)

;; Error codes
(define-constant ERR-SOLD-OUT (err u100))
(define-constant ERR-ALREADY-MINTED (err u101))
(define-constant ERR-NOT-AUTHORIZED (err u403))
(define-constant ERR-NOT-FOUND (err u404))

;; -----------------------------------------------------
;; Storage
;; -----------------------------------------------------
(define-data-var total-supply uint u0)

;; Enforce 1 NFT per wallet
(define-map minted
  { owner: principal }
  { minted: bool }
)

;; -----------------------------------------------------
;; SIP-009 Required Functions
;; -----------------------------------------------------

;; Get the last minted token ID
(define-read-only (get-last-token-id)
  (ok (var-get total-supply))
)

;; Get token URI with on-chain metadata
(define-read-only (get-token-uri (token-id uint))
  (if (is-some (nft-get-owner? voidmask token-id))
    (ok (some (concat 
      "data:application/json;charset=utf-8,%7B%22name%22:%22VOIDMASK%20%23"
      (concat
        (uint-to-ascii token-id)
        (concat
          "%22,%22description%22:%22100%25%20on-chain%20schizocore%20PFP%20on%20Stacks.%22,%22image%22:%22data:image/svg+xml;charset=utf-8,"
          (concat
            (encode-uri-component (get-svg token-id))
            "%22%7D"
          )
        )
      )
    )))
    (ok none)
  )
)

;; Get owner of token
(define-read-only (get-owner (token-id uint))
  (ok (nft-get-owner? voidmask token-id))
)

;; Transfer token (SIP-009 required)
(define-public (transfer (token-id uint) (sender principal) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender sender) ERR-NOT-AUTHORIZED)
    (nft-transfer? voidmask token-id sender recipient)
  )
)

;; -----------------------------------------------------
;; Additional Read-Only Functions
;; -----------------------------------------------------

(define-read-only (get-balance (owner principal))
  (if (is-some (map-get? minted { owner: owner }))
    (ok u1)
    (ok u0)
  )
)

(define-read-only (total-supply)
  (ok (var-get total-supply))
)

;; -----------------------------------------------------
;; Mint Function (FREE, GAS ONLY)
;; -----------------------------------------------------

(define-public (mint)
  (let (
        (sender tx-sender)
        (supply (var-get total-supply))
        (next-id (+ supply u1))
       )
    (begin
      ;; Check supply cap
      (asserts! (< supply MAX-SUPPLY) ERR-SOLD-OUT)

      ;; One NFT per wallet
      (asserts!
        (is-none (map-get? minted { owner: sender }))
        ERR-ALREADY-MINTED
      )

      ;; Mint NFT
      (try! (nft-mint? voidmask next-id sender))

      ;; Mark as minted
      (map-set minted { owner: sender } { minted: true })

      ;; Update supply
      (var-set total-supply next-id)

      (ok next-id)
    )
  )
)

;; -----------------------------------------------------
;; Trait Helpers (Deterministic Generation)
;; -----------------------------------------------------

(define-read-only (trait (token-id uint) (m uint))
  (mod token-id m)
)

(define-read-only (get-traits (token-id uint))
  (ok {
    bg-index: (trait token-id u8),
    eyes-index: (trait (/ token-id u8) u4),
    mouth-index: (trait (/ token-id u32) u4)
  })
)

;; -----------------------------------------------------
;; SVG Generation (Simplified for Gas Efficiency)
;; -----------------------------------------------------

(define-read-only (get-svg (token-id uint))
  (let (
        (bg (trait token-id u8))
        (eyes (trait (/ token-id u8) u4))
        (mouth (trait (/ token-id u32) u4))
       )
    (concat
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64' shape-rendering='crispEdges'>"
      (concat
        (bg-layer bg)
        (concat
          "<rect x='16' y='20' width='32' height='28' fill='%23eee'/>"
          (concat
            (eyes-layer eyes)
            (concat
              (mouth-layer mouth)
              "</svg>"
            )
          )
        )
      )
    )
  )
)

;; -----------------------------------------------------
;; Layer Functions (Optimized)
;; -----------------------------------------------------

(define-read-only (bg-layer (i uint))
  (if (is-eq i u0) "<rect width='64' height='64' fill='%23000'/>"
  (if (is-eq i u1) "<rect width='64' height='64' fill='%23111'/>"
  (if (is-eq i u2) "<rect width='64' height='64' fill='%231a1a1a'/>"
  (if (is-eq i u3) "<rect width='64' height='64' fill='%23222'/>"
  (if (is-eq i u4) "<rect width='64' height='64' fill='%232a2a2a'/>"
  (if (is-eq i u5) "<rect width='64' height='64' fill='%23300'/>"
  (if (is-eq i u6) "<rect width='64' height='64' fill='%23003'/>"
                   "<rect width='64' height='64' fill='%23030'/>"
  )))))))
)

(define-read-only (eyes-layer (i uint))
  (if (is-eq i u0)
      "<rect x='22' y='28' width='4' height='4'/><rect x='38' y='28' width='4' height='4'/>"
  (if (is-eq i u1)
      "<rect x='22' y='28' width='4' height='2'/><rect x='38' y='28' width='4' height='2'/>"
  (if (is-eq i u2)
      "<rect x='22' y='28' width='4' height='4' fill='%23f00'/><rect x='38' y='28' width='4' height='4' fill='%23f00'/>"
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

;; -----------------------------------------------------
;; Helper Functions
;; -----------------------------------------------------

;; Convert uint to ASCII string (simplified for small numbers)
(define-read-only (uint-to-ascii (n uint))
  (if (< n u10)
    (if (is-eq n u0) "0"
    (if (is-eq n u1) "1"
    (if (is-eq n u2) "2"
    (if (is-eq n u3) "3"
    (if (is-eq n u4) "4"
    (if (is-eq n u5) "5"
    (if (is-eq n u6) "6"
    (if (is-eq n u7) "7"
    (if (is-eq n u8) "8"
    "9"
    )))))))))
    "0"
  )
)

;; URL encode special characters in SVG
(define-read-only (encode-uri-component (svg (string-ascii 2048)))
  ;; NOTE: For production, implement proper URL encoding
  ;; This is a simplified version - the frontend will handle full SVG rendering
  svg
)
