# Rill walkthrough - PhoneZone Aadhaar OCR (Add a seller)

This walkthrough covers one user-facing flow in PhoneZone: **adding a new seller
by scanning an Aadhaar card**, where the offline OCR fills the seller form.
Prepared from the project source; it has not been recorded.

## Numbered steps

PhoneZone - Add a seller by scanning an Aadhaar card (offline OCR)

1. Start the app: run `npm run dev:all` (Vite UI + Express backend) and open the local URL the terminal prints (default http://localhost:5173).
2. If the one-time Setup screen appears, complete it, then open the app.
3. In the storefront header click "Admin Panel" (top-right, gear icon), then sign in with your admin account. The login credential is NOT included in this walkthrough.
4. In the admin dashboard open the "Sellers" tab.
5. Click the "Add Seller" button to open the "Add New Seller" dialog.
6. Next to "Scan the seller's Aadhaar to fill the details automatically", click "Scan Front" and pick a photo/screenshot of the FRONT of an Aadhaar card (JPG/PNG) or a PDF e-Aadhaar.
   Expected: the button shows "Reading... n%"; on success the Name and ID Number fields fill in, a line under the buttons lists what was read (e.g. "Front: via QR Name: ... DOB: ..."), and a toast confirms the fill.
7. Click "Scan Back" and pick the BACK of the SAME card.
   Expected: the Address field fills in; the front Name is NOT overwritten.
8. Type the seller's Phone Number (OCR does not supply it), then click "Add Seller".
   Expected: toast "Seller added successfully!" and the new row appears in the Sellers table.

Test data: two photos of the SAME Aadhaar card (front + back), or a UIDAI e-Aadhaar PDF. Use your own or a redacted card when recording.

## Expected behavior (summary)

- Step 6: the "Scan Front" button becomes "Reading... n%"; when the scan finishes
  the **Name** and **ID Number** fields fill in automatically, a small status line
  appears under the buttons listing what was read (front side, QR-vs-OCR, name,
  DOB, gender, mobile, "Address filled"), and a success toast is shown. If the
  number does not pass the Verhoeff checksum the status line says "verify the
  number" and the toast says "please double-check the number".
- Step 7: the **Address** field fills in from the back side; the name read from
  the front is preserved (the merge only fills empty fields for the same person).
- Step 8: after the required Phone Number is entered, saving shows the toast
  "Seller added successfully!" and the seller row appears in the Sellers table.

## Test data

- Two photos (or screenshots) of the **same** Aadhaar card: front and back, as
  JPG/PNG - OR a UIDAI e-Aadhaar **PDF** (best QR accuracy).
- No sample Aadhaar images are stored in this repository (see Missing inputs);
  supply your own, ideally a redacted card, when recording.

## Missing inputs

- `<admin credential>` - the Admin Panel requires a sign-in (Supabase Auth or the
  local admin password). It is deliberately **not** in these steps. Use your own.
- `<sample Aadhaar images>` - no front/back card image ships with the repo; you
  must provide your own document (or a redacted one).
- `<public app URL>` - none was supplied. This app runs on your machine
  (localhost / ngrok), so a cloud recorder cannot reach it.
- `<seller phone number>` - the Aadhaar card does not carry it; you type it in.

## Handoff link

[Open your walkthrough in Rill](https://userill.dev/freebuff?utm_source=freebuff&utm_medium=paid&utm_campaign=rill&utm_content=text-ad&bfcid=bfc_1.eyJpZCI6ImU1N2RiNmZhLTA1MGMtNDFlNy04ZjBiLTRkNWJkMDBlMjUyZSIsImMiOiIxNDQyMTUzOS1kYjNiLTQ1YzEtYjQ5OC1hYTMxOTFmNDkxYzAiLCJrIjoiNDU4ODZlNWEtYzkyZC00ZDUxLTg1ZjgtYzc4YTRmMTY3ZWYwIiwiaWF0IjoxNzkxNjE1NzA1fQ.0sBYNUTw-HZB12eyTsE-1Sv2AepWMEIMt8dVZmI4Nyg#task=PhoneZone%20-%20Add%20a%20seller%20by%20scanning%20an%20Aadhaar%20card%20(offline%20OCR)%0A%0A1.%20Start%20the%20app%3A%20run%20%60npm%20run%20dev%3Aall%60%20(Vite%20UI%20%2B%20Express%20backend)%20and%20open%20the%20local%20URL%20the%20terminal%20prints%20(default%20http%3A%2F%2Flocalhost%3A5173).%0A2.%20If%20the%20one-time%20Setup%20screen%20appears%2C%20complete%20it%2C%20then%20open%20the%20app.%0A3.%20In%20the%20storefront%20header%20click%20%22Admin%20Panel%22%20(top-right%2C%20gear%20icon)%2C%20then%20sign%20in%20with%20your%20admin%20account.%20The%20login%20credential%20is%20NOT%20included%20in%20this%20walkthrough.%0A4.%20In%20the%20admin%20dashboard%20open%20the%20%22Sellers%22%20tab.%0A5.%20Click%20the%20%22Add%20Seller%22%20button%20to%20open%20the%20%22Add%20New%20Seller%22%20dialog.%0A6.%20Next%20to%20%22Scan%20the%20seller's%20Aadhaar%20to%20fill%20the%20details%20automatically%22%2C%20click%20%22Scan%20Front%22%20and%20pick%20a%20photo%2Fscreenshot%20of%20the%20FRONT%20of%20an%20Aadhaar%20card%20(JPG%2FPNG)%20or%20a%20PDF%20e-Aadhaar.%0A%20%20%20Expected%3A%20the%20button%20shows%20%22Reading...%20n%25%22%3B%20on%20success%20the%20Name%20and%20ID%20Number%20fields%20fill%20in%2C%20a%20line%20under%20the%20buttons%20lists%20what%20was%20read%20(e.g.%20%22Front%3A%20via%20QR%20Name%3A%20...%20DOB%3A%20...%22)%2C%20and%20a%20toast%20confirms%20the%20fill.%0A7.%20Click%20%22Scan%20Back%22%20and%20pick%20the%20BACK%20of%20the%20SAME%20card.%0A%20%20%20Expected%3A%20the%20Address%20field%20fills%20in%3B%20the%20front%20Name%20is%20NOT%20overwritten.%0A8.%20Type%20the%20seller's%20Phone%20Number%20(OCR%20does%20not%20supply%20it)%2C%20then%20click%20%22Add%20Seller%22.%0A%20%20%20Expected%3A%20toast%20%22Seller%20added%20successfully!%22%20and%20the%20new%20row%20appears%20in%20the%20Sellers%20table.%0A%0ATest%20data%3A%20two%20photos%20of%20the%20SAME%20Aadhaar%20card%20(front%20%2B%20back)%2C%20or%20a%20UIDAI%20e-Aadhaar%20PDF.%20Use%20your%20own%20or%20a%20redacted%20card%20when%20recording.)

Your walkthrough is prepared. No recording has been made yet. In Rill, review the steps, add a public app URL, and choose Sign up to run if you need an account. The walkthrough uses Interact mode. Press Run to start it.

## Local target - cloud recording alternatives

This flow runs on a local machine (localhost / ngrok), which a cloud run cannot
reach. If you need a recording without a public URL, use one of these instead:

- Manual screen recording: https://userill.dev/record?utm_source=freebuff&utm_medium=paid&utm_campaign=rill
- Record an existing browser agent: https://userill.dev/docs/agent-quickstart?utm_source=freebuff&utm_medium=paid&utm_campaign=rill
