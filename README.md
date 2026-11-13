# Kharcha: Full Stack Expense Tracker

A full stack expense tracker with user accounts, a monthly budget, and charts.

- **Frontend:** HTML, CSS and JavaScript dashboard (`public/index.html`) with SVG charts
- **Backend:** Node.js and Express REST API (`api/index.js`)
- **Database:** MongoDB Atlas, using Mongoose models for users and expenses
- **Auth:** email and password, passwords hashed with bcrypt, sessions with JWT
- **Hosting:** Vercel (frontend and API on one live URL)

## API

| Method | Route | What it does |
|---|---|---|
| POST | /api/auth/register | Create an account |
| POST | /api/auth/login | Log in, returns a token |
| GET | /api/auth/me | Current user |
| GET | /api/expenses | List your expenses |
| POST | /api/expenses | Add an expense |
| PUT | /api/expenses/:id | Edit an expense |
| DELETE | /api/expenses/:id | Delete an expense |
| PUT | /api/budget | Set your monthly budget |
| GET | /api/health | Check the server and database |

## Deploy (about 15 minutes, all free)

### 1. Create the database (MongoDB Atlas)
1. Sign up at mongodb.com/cloud/atlas and create a free **M0** cluster.
2. Under **Database Access**, add a user with a password. Save both.
3. Under **Network Access**, click Add IP Address, then **Allow access from anywhere** (0.0.0.0/0). Vercel needs this.
4. Click **Connect**, then **Drivers**, and copy the connection string. It looks like
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
5. Put your password in place of PASSWORD, and add the database name `kharcha` after `.net/`:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/kharcha?retryWrites=true&w=majority`
   If the password has special characters like `@` or `#`, use a simple password instead.

### 2. Put the code on GitHub
1. Create a new public repository on github.com.
2. Upload every file and folder from this project, with "Add file", then "Upload files". Do not upload `node_modules` or `.env`.

### 3. Deploy on Vercel
1. Sign up at vercel.com with your GitHub account.
2. Click **Add New**, then **Project**, and import your repository.
3. Open **Environment Variables** and add two:
   - `MONGODB_URI` = the connection string from step 1
   - `JWT_SECRET` = any long random text, for example 40 random letters and numbers
4. Click **Deploy**.
5. Open `https://YOUR-PROJECT.vercel.app/api/health`. You should see `{"ok":true,"db":"connected"}`.
6. Open `https://YOUR-PROJECT.vercel.app`, create an account, and add an expense.

That last URL is your live link for the submission form.

If you change environment variables later, redeploy from the Vercel dashboard so they take effect.

## Run on your computer
```
npm install
cp .env.example .env     (then fill in MONGODB_URI and JWT_SECRET)
npm start
```
Open http://localhost:3000

## Project structure
```
api/index.js      Express API, Mongoose models, JWT auth
public/index.html Frontend dashboard and login screen
vercel.json       Routes /api/* to the API function
package.json      Dependencies and scripts
.env.example      Names of the required environment variables
```
