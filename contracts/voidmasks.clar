;; =====================================================
;; VOIDMASKS - SIP-009 COMPLIANT NFT CONTRACT
;; Clarity 4 - Production Ready
;; 100% On-Chain SVG Generation
;; =====================================================

;; Implement SIP-009 NFT trait
(impl-trait 'ST1HCWN2BWA7HKY61AVPC0EKRB4TH84TMV26A4VRZ.nft-trait.nft-trait)

;; Define the NFT
(define-non-fungible-token voidmask uint)

;; =====================================================
;; CONSTANTS
;; =====================================================

(define-constant CONTRACT-OWNER tx-sender)
(define-constant MAX-SUPPLY u10000)

;; Error codes
(define-constant ERR-SOLD-OUT (err u100))
(define-constant ERR-ALREADY-MINTED (err u101))
(define-constant ERR-NOT-TOKEN-OWNER (err u102))
(define-constant ERR-NOT-AUTHORIZED (err u403))
(define-constant ERR-INVALID-TOKEN-ID (err u404))

;; =====================================================
;; DATA STORAGE
;; =====================================================

(define-data-var last-token-id uint u0)

;; Track if address has minted (one per address)
(define-map minted-by-address principal bool)

;; =====================================================
;; SIP-009 REQUIRED FUNCTIONS
;; =====================================================

;; Get the last minted token ID
(define-read-only (get-last-token-id)
  (ok (var-get last-token-id))
)

;; Get the token URI (returns metadata endpoint)
(define-read-only (get-token-uri (token-id uint))
  (if (is-some (nft-get-owner? voidmask token-id))
    (ok (some "https://voidmasks.vercel.app/api/metadata/"))
    (ok none)
  )
)

;; Get the owner of a specific token
(define-read-only (get-owner (token-id uint))
  (ok (nft-get-owner? voidmask token-id))
)

;; Transfer token to another address
(define-public (transfer (token-id uint) (sender principal) (recipient principal))
  (begin
    ;; Verify sender is the token owner
    (asserts! (is-eq tx-sender sender) ERR-NOT-AUTHORIZED)
    ;; Execute transfer
    (nft-transfer? voidmask token-id sender recipient)
  )
)

;; =====================================================
;; ADDITIONAL READ-ONLY FUNCTIONS
;; =====================================================

;; Get total supply minted
(define-read-only (get-total-supply)
  (ok (var-get last-token-id))
)

;; Get balance of address (0 or 1 since limit is one per address)
(define-read-only (get-balance (account principal))
  (ok (if (default-to false (map-get? minted-by-address account)) u1 u0))
)

;; Check if address has already minted
(define-read-only (has-minted (account principal))
  (ok (default-to false (map-get? minted-by-address account)))
)

;; =====================================================
;; MINT FUNCTION (FREE MINT, ONE PER ADDRESS)
;; =====================================================

(define-public (mint)
  (let
    (
      (current-supply (var-get last-token-id))
      (next-token-id (+ current-supply u1))
    )
    ;; Check supply hasn't been exhausted
    (asserts! (< current-supply MAX-SUPPLY) ERR-SOLD-OUT)
    
    ;; Check sender hasn't already minted
    (asserts! (is-none (map-get? minted-by-address tx-sender)) ERR-ALREADY-MINTED)
    
    ;; Mint the NFT to sender
    (try! (nft-mint? voidmask next-token-id tx-sender))
    
    ;; Update state
    (map-set minted-by-address tx-sender true)
    (var-set last-token-id next-token-id)
    
    ;; Return the minted token ID
    (ok next-token-id)
  )
)

;; =====================================================
;; ON-CHAIN SVG GENERATION
;; Deterministic generation from token ID
;; =====================================================

;; Trait calculation helper
(define-read-only (trait (id uint) (modulo uint))
  (mod id modulo)
)

;; Get all traits for a token
(define-read-only (get-traits (token-id uint))
  (ok {
    expression: (trait token-id u10),
    mouth: (trait (/ token-id u10) u9),
    aura: (trait (/ token-id u90) u8),
    corruption: (trait (/ token-id u720) u6),
    symbol: (trait (/ token-id u4320) u6),
    palette: (trait (/ token-id u25920) u8),
    background: (trait (/ token-id u207360) u8)
  })
)

;; Generate complete SVG for a token
(define-read-only (get-svg (token-id uint))
  (let
    (
      (e (trait token-id u10))
      (m (trait (/ token-id u10) u9))
      (a (trait (/ token-id u90) u8))
      (c (trait (/ token-id u720) u6))
      (s (trait (/ token-id u4320) u6))
      (p (trait (/ token-id u25920) u8))
      (b (trait (/ token-id u207360) u8))
    )
    (concat
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64' shape-rendering='crispEdges'>"
      (concat
        (bg-layer b)
        (concat
          (aura-layer a)
          (concat
            (body-layer p)
            (concat
              (expression-layer e)
              (concat
                (mouth-layer m)
                (concat
                  (symbol-layer s)
                  (concat
                    (corruption-layer c)
                    "</svg>"
                  )
                )
              )
            )
          )
        )
      )
    )
  )
)

;; =====================================================
;; SVG LAYER GENERATORS
;; =====================================================

;; Background layer
(define-read-only (bg-layer (variant uint))
  (if (is-eq variant u0) "<rect width='64' height='64' fill='%23000'/>"
  (if (is-eq variant u1) "<rect width='64' height='64' fill='%230a0a0f'/>"
  (if (is-eq variant u2) "<rect width='64' height='64' fill='%231b1b1b'/>"
  (if (is-eq variant u3) "<rect width='64' height='64' fill='%23220022'/>"
  (if (is-eq variant u4) "<rect width='64' height='64' fill='%23002222'/>"
  (if (is-eq variant u5) "<rect width='64' height='64' fill='%23221100'/>"
  (if (is-eq variant u6) "<rect width='64' height='64' fill='%23001122'/>"
                         "<rect width='64' height='64' fill='%23111111'/>"
  ))))))))


;; Body layer (mask base)
(define-read-only (body-layer (variant uint))
  "<rect x='16' y='20' width='32' height='28' fill='%23eee'/>"
)

;; Expression layer (eyes)
(define-read-only (expression-layer (variant uint))
  (if (is-eq variant u0) "<rect x='22' y='28' width='4' height='4'/><rect x='38' y='28' width='4' height='4'/>"
  (if (is-eq variant u1) "<rect x='22' y='28' width='4' height='2'/><rect x='38' y='28' width='4' height='2'/>"
  (if (is-eq variant u2) "<rect x='22' y='28' width='4' height='4' fill='%23f00'/><rect x='38' y='28' width='4' height='4' fill='%23f00'/>"
  (if (is-eq variant u3) "<rect x='22' y='28' width='2' height='4'/><rect x='38' y='28' width='2' height='4'/>"
  (if (is-eq variant u4) "<rect x='22' y='28' width='6' height='2'/><rect x='38' y='28' width='6' height='2'/>"
  (if (is-eq variant u5) "<rect x='22' y='28' width='4' height='4' fill='%2300ff00'/><rect x='38' y='28' width='4' height='4' fill='%2300ff00'/>"
  (if (is-eq variant u6) "<rect x='20' y='28' width='8' height='4'/><rect x='36' y='28' width='8' height='4'/>"
  (if (is-eq variant u7) "<rect x='22' y='28' width='4' height='2' fill='%23ff0'/><rect x='38' y='28' width='4' height='2' fill='%23ff0'/>"
  (if (is-eq variant u8) "<rect x='22' y='26' width='4' height='6'/><rect x='38' y='26' width='4' height='6'/>"
                         "<rect x='22' y='28' width='4' height='4' opacity='0.5'/><rect x='38' y='28' width='4' height='4' opacity='0.5'/>"
  )))))))))
)

;; Mouth layer
(define-read-only (mouth-layer (variant uint))
  (if (is-eq variant u0) ""
  (if (is-eq variant u1) "<rect x='28' y='36' width='8' height='2'/>"
  (if (is-eq variant u2) "<rect x='26' y='36' width='12' height='4'/>"
  (if (is-eq variant u3) "<rect x='28' y='36' width='8' height='1'/>"
  (if (is-eq variant u4) "<rect x='26' y='36' width='4' height='2'/><rect x='34' y='36' width='4' height='2'/>"
  (if (is-eq variant u5) "<rect x='28' y='36' width='8' height='3' fill='%23f00'/>"
  (if (is-eq variant u6) "<rect x='26' y='36' width='12' height='2'/><rect x='28' y='38' width='8' height='2'/>"
  (if (is-eq variant u7) "<rect x='30' y='36' width='4' height='4'/>"
                         "<rect x='26' y='36' width='12' height='6' opacity='0.7'/>"
  ))))))))
)

;; Aura layer
(define-read-only (aura-layer (variant uint))
  (if (is-eq variant u0) ""
  (if (is-eq variant u1) "<rect x='8' y='8' width='48' height='48' fill='none' stroke='%23fff' stroke-width='1'/>"
  (if (is-eq variant u2) "<rect x='8' y='8' width='48' height='48' fill='none' stroke='%2300ff00' stroke-width='2'/>"
  (if (is-eq variant u3) "<rect x='8' y='8' width='48' height='48' fill='none' stroke='%23ff00ff' stroke-width='1'/>"
  (if (is-eq variant u4) "<rect x='10' y='10' width='44' height='44' fill='none' stroke='%23ff0' stroke-width='1'/>"
  (if (is-eq variant u5) "<rect x='8' y='8' width='48' height='48' fill='none' stroke='%2300ffff' stroke-width='2'/>"
  (if (is-eq variant u6) "<rect x='8' y='8' width='48' height='48' fill='none' stroke='%23f00' stroke-width='1' opacity='0.8'/>"
                         "<rect x='12' y='12' width='40' height='40' fill='none' stroke='%23fff' stroke-width='1' opacity='0.5'/>"
  )))))))
)

;; Symbol layer
(define-read-only (symbol-layer (variant uint))
  (if (is-eq variant u0) ""
  (if (is-eq variant u1) "<rect x='30' y='18' width='4' height='8' fill='%23000'/>"
  (if (is-eq variant u2) "<rect x='28' y='16' width='8' height='2' fill='%23000'/><rect x='30' y='18' width='4' height='6' fill='%23000'/>"
  (if (is-eq variant u3) "<circle cx='32' cy='16' r='2' fill='%2300ff00'/>"
  (if (is-eq variant u4) "<rect x='30' y='18' width='4' height='4' fill='%23ff00ff'/>"
                         "<rect x='28' y='16' width='8' height='8' fill='none' stroke='%23ff0' stroke-width='1'/>"
  )))))
)

;; Corruption layer
(define-read-only (corruption-layer (variant uint))
  (if (is-eq variant u0) ""
  (if (is-eq variant u1) "<rect x='18' y='22' width='4' height='4' fill='%23000'/>"
  (if (is-eq variant u2) "<rect x='18' y='22' width='4' height='4' fill='%23000'/><rect x='42' y='22' width='4' height='4' fill='%23000'/>"
  (if (is-eq variant u3) "<rect x='18' y='22' width='4' height='4' fill='%23f00' opacity='0.6'/>"
  (if (is-eq variant u4) "<rect x='18' y='22' width='2' height='8' fill='%23000'/><rect x='44' y='22' width='2' height='8' fill='%23000'/>"
                         "<rect x='18' y='22' width='6' height='6' fill='%2300ff00' opacity='0.4'/><rect x='40' y='22' width='6' height='6' fill='%2300ff00' opacity='0.4'/>"
  )))))
)
