;; VOIDMASKS - SIP-009 NFT Contract
;; On-chain SVG generation from token IDs

(define-constant ERR-NOT-AUTHORIZED u1)
(define-constant ERR-NOT-FOUND u2)
(define-constant ERR-ALREADY-MINTED u3)

;; SIP-009 REQUIRED FUNCTIONS
(define-read-only (get-last-token-id)
  (ok (default-to u0 (get last-token-id (map-get? token-state {id: u0})))))

(define-read-only (get-token-uri (token-id uint)))
  (ok (some (concat "data:image/svg+xml;base64," (generate-svg-base64 token-id))))

(define-read-only (get-owner (token-id uint))
  (match (map-get? token-owners {id: token-id})
    owner (ok (some owner.owner))
    (err ERR-NOT-FOUND)))

(define-read-only (get-name)
  (ok "VOIDMASKS"))

(define-read-only (get-symbol)
  (ok "VMASK"))

(define-read-only (get-decimals)
  (ok u0))

;; CORE STATE
(define-map token-owners
  {id: uint}
  {owner: principal})

(define-map token-state
  {id: uint}
  {minted: bool})

(define-data-var last-token-id uint u0)
(define-data-var total-supply uint u0)

;; MINT FUNCTION
(define-public (mint)
  (let ((new-id (+ (var-get last-token-id) u1)))
    (asserts! (not (get minted (default-to {minted: true} (map-get? token-state {id: new-id}))))
      (err ERR-ALREADY-MINTED))
    
    ;; Mint the token
    (map-set token-owners {id: new-id} {owner: tx-sender})
    (map-set token-state {id: new-id} {minted: true})
    (var-set last-token-id new-id)
    (var-set total-supply (+ (var-get total-supply) u1))
    
    (ok new-id)))

;; TRANSFER FUNCTION (SIP-009)
(define-public (transfer (token-id uint) (sender principal) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-eq (get-owner-value token-id) sender) (err ERR-NOT-AUTHORIZED))
    
    (map-set token-owners {id: token-id} {owner: recipient})
    (ok true)))

;; HELPER FUNCTIONS
(define-read-only (get-owner-value (token-id uint))
  (default-to 'ST000000000000000000002AMW42H (get owner 
    (default-to {owner: 'ST000000000000000000002AMW42H} 
      (map-get? token-owners {id: token-id})))))

(define-read-only (generate-svg-base64 (token-id uint))
  ;; Base64 encoded SVG generation
  (let ((svg-string (generate-svg token-id)))
    ;; In practice, you'd encode to base64 here
    ;; For demo purposes, returning raw SVG wrapped in data URI
    (concat "data:image/svg+xml," svg-string)))

(define-read-only (generate-svg (token-id uint))
  ;; Deterministic SVG generation from token ID
  (let ((seed (to-int token-id))
        (bg-color (hash-color seed 0))
        (shape-color (hash-color seed 1))
        (pattern (hash-pattern seed)))
    (concat 
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'>"
      (concat "<rect width='400' height='400' fill='" bg-color "'/>")
      (generate-shape pattern shape-color)
      "</svg>")))

(define-read-only (hash-color (seed int) (offset int))
  ;; Generate deterministic color from seed
  (let ((hash-val (+ seed offset))
        (r (mod (abs hash-val) 256))
        (g (mod (abs (* hash-val 17)) 256))
        (b (mod (abs (* hash-val 31)) 256)))
    (concat "#" 
      (concat (int-to-hex r) 
        (concat (int-to-hex g) (int-to-hex b))))))

(define-read-only (hash-pattern (seed int))
  ;; Generate pattern type from seed
  (mod (abs seed) 5))

(define-read-only (generate-shape (pattern int) (color string))
  (if (is-eq pattern 0)
    (concat "<circle cx='200' cy='200' r='100' fill='" color "' opacity='0.8'/>")
    (if (is-eq pattern 1)
      (concat "<polygon points='200,100 300,300 100,300' fill='" color "' opacity='0.8'/>")
      (if (is-eq pattern 2)
        (concat "<rect x='100' y='100' width='200' height='200' fill='" color "' opacity='0.8'/>")
        (if (is-eq pattern 3)
          (concat "<path d='M100,200 Q200,50 300,200 T100,200' fill='" color "' opacity='0.8'/>")
          (concat "<ellipse cx='200' cy='200' rx='150' ry='80' fill='" color "' opacity='0.8'/>"))))))

(define-read-only (int-to-hex (val int))
  ;; Convert integer to 2-digit hex
  (let ((hex-chars "0123456789ABCDEF")
        (first-digit (get (mod (abs (/ val 16)) 16) hex-chars))
        (second-digit (get (mod (abs val) 16) hex-chars)))
    (concat first-digit second-digit)))

;; SIP-009 BALANCE AND SUPPLY FUNCTIONS
(define-read-only (balance-of (owner principal))
  (ok (count-tokens-for-owner owner)))

(define-read-only (total-supply)
  (ok (var-get total-supply)))

(define-read-only (count-tokens-for-owner (owner principal))
  ;; Count tokens owned by principal
  (let ((last-id (default-to u0 (get last-token-id (map-get? token-state {id: u0})))))
    (count-owned-tokens owner u1 last-id u0)))

(define-read-only (count-owned-tokens (owner principal) (current-id uint) (last-id uint) (count uint))
  (if (> current-id last-id)
    count
    (let ((token-owner (get-owner-value current-id)))
      (count-owned-tokens owner (+ current-id u1) last-id
        (if (is-eq token-owner owner) (+ count u1) count)))))