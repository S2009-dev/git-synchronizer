# GIT Synchronizer

Sync your GitHub with a VPS

## Index

- [Intro](#git-synchronizer)
- [Index](#index)
- [Get a GitHub Token](#get-a-github-token)
- [Setup the VPS synchronizer (Part 1)](#setup-the-vps-synchronizer-part-1)
- [Setup the VPS synchronizer (Part 2)](#setup-the-vps-synchronizer-part-2)
- [Add a GitHub Webhook (Part 1)](#add-a-github-webhook-part-1)
- [Add a GitHub Webhook (Part 2)](#add-a-github-webhook-part-2)
- [Finish](#finish)

## Get a GitHub Token

1. Go to **<https://github.com/settings/personal-access-tokens/new>** (type your **2fa code** if necessary)

2. Add a **name** for your token
3. Select the **resource owner** of your token (your **account** or an **organization**)
4. Add a date for the token's **expiration** (max 1 year)
5. Add the **description** of your token
6. Select the type of **repository access** (I recommend choosing **Only select repositories** option)
7. In **Repository permissions**, go to **Contents** and set it to **read and write**
8. **Generate** your token
9. **Copy** your token and **keep it** preciously

## Setup the VPS synchronizer (Part 1)

1. **Config your GIT** by executing following commands:

    ```sh
    git config --global user.name "VPS" # It's not the name of your GitHub's account
    git config --global user.email "vps@example.com" # Can be a fake email
    git config --global init.defaultBranch main # Or master
    ```

2. In the .bashrc / .zshrc file, **add this lines**:

    ```sh
    #GIT Synchronizer
    export GIT_TOKEN=<TOKEN> # Replace <TOKEN> by your GitHub Token
    ```

3. **Restart the .bashrc / .zshrc** file with `source ~/.bashrc` / `source ~/.zshrc`

4. **Create** a `/var/git_remote` folder
5. **Add the [deployer](/deployer.sh)** to the `/var/git_remote` folder
6. **Create** as many folders as there are repos to synchronize in `/var/git_remote`

## Setup the VPS synchronizer (Part 2)

1. **Go to** the folder that you've created in `/var/git_remote`

2. **Execute** the following commands in the folder:

    ```sh
    git init
    git remote add origin https://${GIT_TOKEN}@github.com/<USERNAME>/<REPO>.git # Replace <USERNAME> by your GitHub's username and the <REPO> by the name of the GitHub's repo to synchronize
    git pull origin main
    git branch --set-upstream-to=origin/main main # origin/main must be origin/ "the master branch of the repo" and main must be the init.defaultBranch name
    git stash # Prevents encountering an error when synchronization
    git pull # You can now use git pull instead of git pull origin main
    ```

3. **Repeat [this process](#setup-the-vps-synchronizer-part-2)** for each folders created in `/var/git_remote`

## Add a GitHub Webhook (Part 1)

1. **Add** the content of the **[git_remote folder](/git_remote/)** of this repo in `/var/git_remote`

2. **Edit** `index.php` according to your needs
3. **Execute** a `composer i` in `/var/git_remote`
4. **Add** a `.env` file with the following lines:

    ```toml
    BASE_URL = "https://github.com/<YOUR_GITHUB_USERNAME>/"
    SECRET = "<PASTE_ANY_GENERATED_CODE_HERE>" # Don't use the $ character in the secret !!!
    ```

5. **Configure and run** a PHP server (apache/nginx) in `/var/git_remote` and **point** a URL to it

6. **Copy** the URL that point to the PHP server and the SECRET stored in `/var/git_remote/.env`

## Add a GitHub Webhook (Part 2)

1. **Go** in the **Webhooks** section of a synchronized repository **settings**

2. **Add** a webhook
3. **Set** the **Payload URL** to the URL that you've copied
4. **Set** the **Content Type** to `application/json`
5. **Set** the **Secret** to the SECRET that you've copied
6. **Select** **"Send me everything"** for *"Which events would you like to trigger this webhook?"*
7. **Create** the webhook

## Finish

GG you've synchronized GitHub with your VPS !!! 🎉

If you've encountered errors in the process that you cannot resolve, check that all permissions are granted etc. Otherwise create an issue or contact me ^^

Contact me:

- <https://softlightgames.fr/>
- <https://s2009.fr/>
