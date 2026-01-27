;; =====================================================
;; VOIDMASKS - SIP-009 - Clarity 4 - Phase-8 Schizocore
;; FINAL PRODUCTION VERSION
;; =====================================================

(impl-trait 'ST1HCWN2BWA7HKY61AVPC0EKRB4TH84TMV26A4VRZ.nft-trait.nft-trait)

(define-non-fungible-token voidmask uint)

(define-constant MAX-SUPPLY u10000)

(define-constant ERR-SOLD-OUT (err u100))
(define-constant ERR-ALREADY-MINTED (err u101))
(define-constant ERR-NOT-AUTH (err u403))

;; -----------------------------------------------------
;; Storage
;; -----------------------------------------------------

(define-data-var total-supply uint u0)

(define-map minted
  { owner: principal }
  { minted: bool }
)

;; -----------------------------------------------------
;; SIP-009 REQUIRED
;; -----------------------------------------------------

(define-read-only (get-last-token-id)
  (ok (var-get total-supply))
)

(define-read-only (get-owner (token-id uint))
  (ok (nft-get-owner? voidmask token-id))
)

(define-public (transfer (token-id uint) (sender principal) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender sender) ERR-NOT-AUTH)
    (nft-transfer? voidmask token-id sender recipient)
  )
)

;; -----------------------------------------------------
;; Supply / Balance
;; -----------------------------------------------------

(define-read-only (get-total-supply)
  (ok (var-get total-supply))
)

(define-read-only (get-balance (owner principal))
  (ok (if (is-some (map-get? minted { owner: owner })) u1 u0))
)

;; -----------------------------------------------------
;; Mint (FREE)
;; -----------------------------------------------------

(define-public (mint)
  (let (
        (sender tx-sender)
        (supply (var-get total-supply))
        (id (+ supply u1))
       )
    (begin
      (asserts! (< supply MAX-SUPPLY) ERR-SOLD-OUT)
      (asserts!
        (is-none (map-get? minted { owner: sender }))
        ERR-ALREADY-MINTED
      )
      (try! (nft-mint? voidmask id sender))
      (map-set minted { owner: sender } { minted: true })
      (var-set total-supply id)
      (ok id)
    )
  )
)

;; -----------------------------------------------------
;; Trait Math (Phase-8)
;; -----------------------------------------------------

(define-read-only (trait (id uint) (m uint))
  (mod id m)
)

(define-read-only (get-traits (id uint))
  (ok {
    expression: (trait id u10),
    mouth: (trait (/ id u10) u9),
    aura: (trait (/ id u90) u8),
    corruption: (trait (/ id u720) u6),
    symbol: (trait (/ id u4320) u6),
    palette: (trait (/ id u25920) u8),
    background: (trait (/ id u207360) u8)
  })
)

;; -----------------------------------------------------
;; Metadata (INDEXER SAFE)
;; -----------------------------------------------------

(define-read-only (get-token-uri (token-id uint))
  (if (is-some (nft-get-owner? voidmask token-id))
    (ok (some "data:application/json,{}"))
    (ok none)
  )
)


;; -----------------------------------------------------
;; SVG GENERATOR (SAFE CONCAT)
;; -----------------------------------------------------

(define-read-only (get-svg (id uint))
  (let (
        (e (trait id u10))
        (m (trait (/ id u10) u9))
        (a (trait (/ id u90) u8))
        (c (trait (/ id u720) u6))
        (s (trait (/ id u4320) u6))
        (p (trait (/ id u25920) u8))
        (b (trait (/ id u207360) u8))
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

;; -----------------------------------------------------
;; SVG LAYERS
;; -----------------------------------------------------

(define-read-only (bg-layer (i uint))
  (if (is-eq i u0) "<rect width='64' height='64' fill='%23000'/>"
  (if (is-eq i u1) "<rect width='64' height='64' fill='%230a0a0f'/>"
  (if (is-eq i u2) "<rect width='64' height='64' fill='%231b1b1b'/>"
  (if (is-eq i u3) "<rect width='64' height='64' fill='%23220022'/>"
  (if (is-eq i u4) "<rect width='64' height='64' fill='%23002222'/>"
  (if (is-eq i u5) "<rect width='64' height='64' fill='%23221100'/>"
  (if (is-eq i u6) "<rect width='64' height='64' fill='%23001122'/>"
                   "<rect width='64' height='64' fill='%23111111'/>"
  ))))))))

(define-read-only (body-layer (p uint))
  "<rect x='16' y='20' width='32' height='28' fill='%23eee'/>"
)

(define-read-only (expression-layer (e uint))
  (if (is-eq e u0) "<rect x='22' y='28' width='4' height='4'/><rect x='38' y='28' width='4' height='4'/>"
  (if (is-eq e u1) "<rect x='22' y='28' width='4' height='2'/><rect x='38' y='28' width='4' height='2'/>"
  (if (is-eq e u2) "<rect x='22' y='28' width='4' height='4' fill='%23f00'/><rect x='38' y='28' width='4' height='4' fill='%23f00'/>"
                   "<rect x='22' y='28' width='2' height='4'/><rect x='38' y='28' width='2' height='4'/>"
  )))
)

(define-read-only (mouth-layer (m uint))
  (if (is-eq m u0) ""
  (if (is-eq m u1) "<rect x='28' y='36' width='8' height='2'/>"
                   "<rect x='26' y='36' width='12' height='4'/>"
  ))
)

(define-read-only (aura-layer (a uint))
  (if (is-eq a u0) ""
                   "<rect x='8' y='8' width='48' height='48' fill='none' stroke='%23fff' stroke-width='1'/>"
  )
)

(define-read-only (symbol-layer (s uint))
  (if (is-eq s u0) ""
                   "<rect x='30' y='18' width='4' height='8' fill='%23000'/>"
  )
)

(define-read-only (corruption-layer (c uint))
  (if (is-eq c u0) ""
                   "<rect x='18' y='22' width='4' height='4' fill='%23000'/>"
  )
)
