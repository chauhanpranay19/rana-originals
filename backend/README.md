# Rana Originals backend (Google Sheet + Apps Script)

The shop's real "database" is one Google Sheet. A small Apps Script program attached to that sheet
answers the website. Product photos go into a Google Drive folder. All of it is free.

You do this once, signed in with the Google account that should own the shop data.

## What is in this folder

| File | What it does |
| --- | --- |
| `Logic.gs` | The shop rules: stock holds, orders, payments, admin passcode. |
| `SheetDb.gs` | Reads and writes rows in the sheet. |
| `Code.gs` | Answers the website (`doGet` / `doPost`) and saves photos to Drive. |
| `Setup.gs` | `setup()`: creates the tabs, the six starting items, the photo folder and a timer. |
| `appsscript.json` | Settings for Apps Script (who can call it, which permissions it needs). |
| `test/` | Tests you can run on your Mac. Not uploaded to Google. |

## Way 1: copy and paste (easiest)

1. Go to https://sheets.google.com and make a new blank sheet. Name it "Rana Originals".
2. In the sheet menu: **Extensions → Apps Script**. A code editor opens.
3. On the left, click the gear (**Project Settings**) and tick
   **Show "appsscript.json" manifest file in editor**.
4. Back in the editor (the `< >` icon), for each file in this folder:
   - `Code.gs`: replace everything in the existing `Code.gs` with this file's text.
   - `Logic.gs`, `SheetDb.gs`, `Setup.gs`: click **+ → Script**, type the name without `.gs`, paste.
   - `appsscript.json`: replace its text with this file's text.
   - Press **Cmd+S** to save.
5. Set the admin passcode (see below).
6. In the toolbar, choose `setup` in the function list and press **Run**.
   Google asks for permission the first time: pick your account, then
   **Advanced → Go to (project name)** → **Allow**. (It says "unverified" because you wrote the app yourself.)
7. Deploy as a web app (see "Deploy" below).

## Way 2: with clasp (command line)

`clasp` is Google's tool for uploading Apps Script files from your Mac.

```sh
npm install -g @google/clasp      # installs clasp for all projects (ask first if unsure)
clasp login                       # opens the browser to sign in to Google
```

Turn on the Apps Script API once at https://script.google.com/home/usersettings.

Then, from the project folder:

```sh
cd ~/code/rana-store/backend
clasp create --type sheets --title "Rana Originals" --rootDir .
```

This makes a new Google Sheet with a script attached and writes `.clasp.json`.
To stop clasp uploading the tests, create `backend/.claspignore` with these lines:

```
test/**
README.md
```

Then upload and open:

```sh
clasp push        # uploads the .gs files and appsscript.json
clasp open        # opens the script editor in the browser
```

Then do steps 5 to 7 of Way 1 (passcode, run `setup`, deploy).

## Set the admin passcode

The passcode lives only in Script Properties, never in the sheet or in the website code.

1. In the Apps Script editor: gear icon (**Project Settings**) → scroll to **Script Properties**.
2. **Add script property**. Property: `ADMIN_PASSCODE`. Value: a passcode only Atul knows
   (at least 8 characters; longer is better).
3. **Save script properties**.

To change it later, edit the value. Changing it logs out every phone that was logged in.
After 8 wrong tries in 15 minutes the login pauses for 15 minutes for everyone.
(Apps Script cannot see who is asking, so the pause is shared.)

## Deploy (make the web app URL)

1. In the editor: **Deploy → New deployment**.
2. Gear next to "Select type" → **Web app**.
3. Execute as: **Me**. Who has access: **Anyone**.
4. **Deploy**. Copy the **Web app URL** (it ends in `/exec`).
5. Open `assets/config.js` in the website and paste it:
   ```js
   window.RO_CONFIG = { apiUrl: 'https://script.google.com/macros/s/XXXX/exec' };
   ```
6. Check it works: open the URL with `?action=settings` on the end in a browser.
   You should see `{"ok":true,"settings":{...}}`.
7. Open the admin page, enter the passcode, then **Settings** (gear) and set the real UPI ID,
   payee name and WhatsApp number. (The starting values are placeholders.)

`demo.html` always stays in demo mode, even with the URL set.

## Redeploy after changing the code

Saving code does **not** change what the website talks to. After a change:

1. Save (or `clasp push`).
2. **Deploy → Manage deployments** → pencil icon on your deployment →
   Version: **New version** → **Deploy**.

This keeps the same URL, so `config.js` does not change. ("New deployment" would make a new URL.)

If you changed `appsscript.json` permissions, run `setup` once more so Google asks again.

## Photos

New photos from the admin are saved in the Drive folder "Rana Originals photos", shared as
"anyone with the link can view", and stored in the sheet as links of this form:

```
https://lh3.googleusercontent.com/d/FILE_ID
```

**Check after the first real deploy:** add one item with a photo and see that it shows in the shop.
If it does not, change the one line in `driveImageUrl_` in `Code.gs` to
`'https://drive.google.com/thumbnail?id=' + id + '&sz=w1200'`, redeploy, and run `rewritePhotoUrls`
once from the editor to fix links already saved.

The six starting items use the photos in the website's `photos/web/` folder (paths like
`photos/web/lot1-4.jpg`), so those must be uploaded with the website.

Deleting an item does not delete its photos from Drive.

## The sheet

- **Products**: one row per item. `sizes` and `photos` are JSON text, for example
  `[{"label":"M","qty":2}]`. You can fix a typo here by hand, but use the admin for stock.
- **Orders**: one row per order. `items` and `history` are JSON text.
- **Customers**: one row per customer phone/device. The `token` column holds a scrambled
  (hashed) copy of the device's secret, not the secret itself.
- **Settings**: shop name, UPI ID, payee name, WhatsApp number, the next order number and the
  photo folder id.

Do not rename the tabs or the header row. Extra columns at the right are kept.

## Run the tests on your Mac

```sh
node backend/test/logic.test.js      # the shop rules
node backend/test/sheetdb.test.js    # the sheet reading/writing code
```

To try the real-shop mode without Google, run a local stand-in:

```sh
node backend/test/stub-server.js     # prints a passcode for this run
```

Set `apiUrl` in `assets/config.js` to `'http://localhost:4180/exec'`, reload the shop, and put it back
to `''` when done. Data in the stand-in is lost when you stop it (Ctrl+C).

## Things to check after the first real deploy

1. `?action=settings` answers JSON (step 6 above).
2. A photo added in the admin shows in the shop (see Photos).
3. Buy a cheap item from a phone: the order appears in the Orders tab of the sheet within a few seconds.
4. Leave an order unpaid for 20 minutes: its row should change to `expired` and the stock come back.
5. In the editor, **Triggers** (clock icon) lists `sweepExpired` every 5 minutes.
6. In the sheet, phone numbers and UPI references show as typed (no lost leading zeros, no `1E+11`).
