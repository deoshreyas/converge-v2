---
title: How to create a Discord Bot
author: shr
description: Learn how to create a simple Discord bot using Python and discord.py
bannerImg: /assets/DiscordGuideBanner.png
---

<p align="center"><img src="/assets/WeHaveProx2AtHomeGif.gif" alt="WeHaveProx2AtHome Demo" width="600"></p>

**Mandatory PSA**: Slack > Discord. Do not attempt to change my mind. You will fail.

Hey :D

So you want to make a Discord bot? Great! This guide will walk you through the steps to create a simple Discord bot using Python and [discord.py](https://discordpy.readthedocs.io/en/stable/). 

*Please note: I will be assuming you know basic Python. There is no other prerequisite, this guide can be used by people who have never made a Discord bot too.*

We will be making a Discord version of Prox2 from the Hack Club Slack! If you don't know what that is, it's a bot that helps anonymize people in the `#confessions` channel. Here's a basic rundown of how it works:
```
You send a message to the bot (by DMing it or the `\prox2` command) -> The bot assigns an ID to your confessions -> The confession is sent to a private review channel -> The review team approves/denies it -> If approved, the confession is posted in #confessions without any identifying information.
```
Decisions are logged in `#confessions-log`, and `#confessions-meta` is used for general community discussion. The bot is as anonymous as possible (by salting User IDs), and no one on the review team or the Slack can know who sent the confession (unless the user reveals it, or Slack hands over the data (very unlikely)).

The actual bot is actually really complex, so we will be making a *highly* simplified version for Discord. Here's what it will do:
```
You DM the bot -> The bot assigns an ID to your confession -> The confession is sent to a private review channel -> The review team approves/denies it -> If approved, the confession is posted in the #confessions channel.
```

Full credits to the people who made the original Prox2 bot, it's so cool! Here's the [GitHub repository](https://github.com/anirudhb/prox2) if you want to check it out (you really should!).

## Step 1: Setting up the environment

Create a folder for your bot and give it a name (I have chosen to call this "WeHaveProx2AtHome" because that is peak humour).

Next let's set up a virtual environment for our project. Open your terminal and run the following commands:

```bash
python -m venv venv
source venv/bin/activate
```

*If you're on Windows, use `venv\Scripts\activate` instead of `source venv/bin/activate`.*

Now, install the following packages:

```bash
pip install discord.py aiosqlite
```

`discord.py` is the library we'll use to interact with the Discord API, and `aiosqlite` will help us manage our SQLite database *asynchronously*.

> Asynchronous programming just means that we can run multiple tasks at the same time without waiting for each to finish before starting the next. 

## Step 2: Actually coding the bot

Create a new file named `.env` in your project folder. This file will store your tokens securely. Add the following lines to the `.env` file (we'll add the actual tokens later):

```
BOT_TOKEN=
REVIEW_CHANNEL_ID=
CONFESSIONS_CHANNEL_ID=
```

Now, create a new file named `main.py` in your project folder. This file will store all the code for our bot. Open `main.py` and import the necessary libraries:

```python
import discord # For Discord API interactions
import os # For environment variable management
import aiosqlite # For asynchronous database operations
from discord.ext import commands # For command handling
from discord.ui import View, Button, button # For creating interactive buttons
from dotenv import load_dotenv # For loading environment variables from .env file
```

Next, load the environment variables and set up the bot:

```python
load_dotenv()
TOKEN = os.getenv('DISCORD_TOKEN')
REVIEW_CHANNEL_ID = int(os.getenv('REVIEW_CHANNEL_ID'))
CONFESSIONS_CHANNEL_ID = int(os.getenv('CONFESSIONS_CHANNEL_ID'))
```

Now, let's set up the bot with the necessary *intents*.

> Intents are a way to specify which events your bot will receive from Discord. So stuff like messages, reactions, DMs, etc. 

```python
intents = discord.Intents.default()   # Get the default intents 
intents.message_content = True        # Enable Message Content intent
intents.dm_messages = True            # Enable DM Messages intent
intents.guilds = True                 # Enable Guilds (servers) intent
intents.members = True                # Enable Members intent
```

> The Message Content intent is required to read message content, the DM Messages intent is needed to handle direct messages, the Guilds intent allows the bot to interact with servers, and the Members intent is necessary for managing and accessing member information.

Now we will initialise a bot instance with these intents:

```python
bot = commands.Bot(command_prefix="!", intents=intents)
```

*Note: The `command_prefix="!"` argument specifies the prefix that will be used for bot commands. While not needed for this bot, it's a good practice to include one in case we want to add commands later.*

Next we will set up some functions to interact with the SQLite database. Add the following code to `main.py`:

```python
DB_NAME = 'confessions.db'

async def init_db():
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS confessions (
                confession_id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                review_message_id INTEGER
            )
        """)
        await db.commit()
```

Pretty self-explanatory, right? This function simply initialises the database and creates a table for storing confessions if it doesn't already exist. The table has four columns:
- `confession_id`: #1, #2, etc.
- `content`: The content of the confession.
- `status`: The status of the confession (e.g., pending, approved, rejected).
- `review_message_id`: The ID of the message in the review channel.

Now let's make some helper functions to add, retrieve and update confessions in the database. Add the following code to `main.py`:

```python
async def add_confession(content):
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute("INSERT INTO confessions (content) VALUES (?)", (content,))
        await db.commit()
        return cursor.lastrowid # This gets the new confession_id

async def get_confession(confession_id):
    async with aiosqlite.connect(DB_NAME) as db:
        async with db.execute("SELECT content, status FROM confessions WHERE confession_id = ?", (confession_id,)) as cursor:
            return await cursor.fetchone()

async def update_confession_status(confession_id, status):
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("UPDATE confessions SET status = ? WHERE confession_id = ?", (status, confession_id))
        await db.commit()
```

Let's go over these functions quickly:
- `add_confession`: Adds a new confession to the database and returns the new confession ID.
- `get_confession`: Retrieves a confession by its ID.
- `update_confession_status`: Updates the status of a confession.

Now we will create a view with approve and deny buttons for the review process (basically a preview of the confession with buttons to approve or deny it for the team in `#confessions-review`). 

To do this, we will inherit from `discord.ui.View` and create two buttons using the `@button` decorator. `discord.ui.View` is a class that allows us to create interactive UI components like buttons, dropdowns and modals in Discord messages. To learn more about it, check out the [official documentation](https://discordpy.readthedocs.io/en/stable/interactions/api.html#discord.ui.View).

Add the following code to `main.py`:

```python
class ReviewView(View):
    def __init__(self, confession_id):
        super().__init__(timeout=None) # Persistent view with no timeout
        self.confession_id = confession_id
        self.approve_button.custom_id = f"approve_{confession_id}"
        self.reject_button.custom_id = f"reject_{confession_id}"
```

Here we define the `ReviewView` class that takes a `confession_id` as an argument. We set the buttons' `custom_id` to include the confession ID so we can identify which confession is being approved or rejected later. Notice the `timeout=None` parameter in the `super().__init__()` call. This makes the view persistent, meaning it will not expire after a certain time.

```python
    async def send_to_channels(self, interaction):
        confession_data = await get_confession(self.confession_id)
        if not confession_data:
            await interaction.followup.send("Error: Could not find this confession.", ephemeral=True)
            return

        content, status = confession_data
        
        # Send to public #confessions channel
        confessions_channel = bot.get_channel(CONFESSIONS_CHANNEL_ID)
        if confessions_channel:
            await confessions_channel.send(f"**#{self.confession_id}:** {content}")
        else:
            print(f"Error: Could not find confessions channel with ID {CONFESSIONS_CHANNEL_ID}")
            await interaction.followup.send("Error: Could not find the public confessions channel.", ephemeral=True)
            return
            
        # Update the database
        await update_confession_status(self.confession_id, "approved")

        # Edit the review message
        embed = interaction.message.embeds[0]
        embed.color = discord.Color.green()
        embed.set_footer(text=f"✅ Approved by {interaction.user.display_name}")

        # Disable all buttons
        for item in self.children:
            item.disabled = True
            
        await interaction.message.edit(embed=embed, view=self)
```

Now we define the `send_to_channels` method that fetches the confession data, sends it to the public `#confessions` channel, updates the database, and edits the review message to indicate that the confession was approved/rejected by someone. The buttons are also disabled after approval/rejection to prevent further interaction.

Now we will add the button handlers for approving and rejecting confessions. 

```python
    @button(label="Approve", style=discord.ButtonStyle.green)
    async def approve_button(self, interaction, button):
        await interaction.response.defer() 
        await self.send_to_channels(interaction)
```

The `interaction.response.defer()` line acknowledges the button click, giving us more time to process the request without timing out. We then call the `send_to_channels` method to handle the approval process. Next, we will add the reject button handler.

```python
    @button(label="Reject", style=discord.ButtonStyle.red)
    async def reject_button(self, interaction, button):
        await interaction.response.defer()
        await update_confession_status(self.confession_id, "rejected")
        embed = interaction.message.embeds[0]
        embed.color = discord.Color.red()
        embed.set_footer(text=f"❌ Rejected by {interaction.user.display_name}")
        for item in self.children:
            item.disabled = True
        await interaction.message.edit(embed=embed, view=self)
```

The reject button handler works similarly to the approve button handler. It updates the confession status to "rejected" in the database and edits the review message to indicate rejection. The buttons are also disabled after rejection.

Now we will set up the bot and add the necessary event handlers. Add the following code to `main.py`:

```python
@bot.event
async def on_ready():
    """Called when the bot logs in."""
    await init_db() # Initialize the database
    print(f'Logged in as {bot.user}')
    print('Bot is ready and database is initialized.')
```

The `@bot.event` decorator registers the `on_ready` event handler, which is called when the bot logs in. We just initialize the database and print a message to the console.

> In Python, decorators are a way to modify the behavior of functions or methods. They are used to wrap functions with additional functionality without changing their code directly. In this case, `@bot.event` is a decorator that registers the function below it as an event handler for the bot. You can learn more about decorators [here](https://realpython.com/primer-on-python-decorators/).

Finally, we will add the event handler for handling DMs from users. Add the following code to `main.py`: 

```python
@bot.event
async def on_message(message: discord.Message):
    # Ignore messages from the bot itself
    if message.author == bot.user:
        return

    if isinstance(message.channel, discord.DMChannel):
        try:
            confession_content = message.content
            confession_id = await add_confession(confession_content)
            await message.author.send(f"Your message was staged as **confession #{confession_id}** and will appear in <#{CONFESSIONS_CHANNEL_ID}> if approved.")
            review_channel = bot.get_channel(REVIEW_CHANNEL_ID)
            if review_channel:
                embed = discord.Embed(
                    title=f"New Confession Submission (#{confession_id})",
                    description=confession_content,
                    color=discord.Color.blue()
                )
                view = ReviewView(confession_id)
                
                await review_channel.send(embed=embed, view=view)
            else:
                print(f"Error: Could not find review channel with ID {REVIEW_CHANNEL_ID}")
                await message.author.send("Sorry, there was an internal error submitting your confession.")

        except Exception as e:
            print(f"Error handling DM: {e}")
            await message.author.send("Sorry, an error occurred while processing your confession. Please try again later.")
```

The `on_message` event handler simply listens for messages sent to the bot. If the message is a DM, it adds the confession to the database, sends a confirmation message to the user, and forwards the confession to the review channel with the `ReviewView` containing the approve and reject buttons.

*Note: If you plan on adding commands later, this is also the function where you would process them.*

Now we just add the following line at the end of `main.py` to run the bot:

```python
bot.run(TOKEN)
```

And we are done with the code :D

## Step 3: Setting up the bot on Discord

The good news? We have already done most of the hard work by coding the bot. 
The slightly less good news? We now have to set up the bot on Discord and get the necessary tokens and IDs before it'll work. It is easy though, don't worry!

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and log in with your Discord account. Next, click on "New Application".

<p align="center"><img src="/assets/1.png" alt="New Application Button" width="600"></p>

2. Give your application a name (for example, "WeHaveProx2AtHome"). Click "Create".

<p align="center"><img src="/assets/2.png" alt="New Application Name" width="500"></p>

3. In the left sidebar, click on "Bot" and then generate a token by clicking on "Reset token". Confirm the action. Copy the generated token and paste it in the `BOT_TOKEN` field in your `.env` file. Also scroll down and enable the `Server Members Intent` and `Message Content Intent` options. Save changes!

<p align="center"><img src="/assets/3.png" alt="Intent Options" width="600"></p>

*Optional: You can also set a profile picture for your bot here!*

4. Next, go to the server (or create a test server) where you want to add the bot, and create two channels - a private channel named `#confessions-review` for the review team, and a public channel named `#confessions` where approved confessions will be posted. 

5. You will also need to enable developer mode to get the channel IDs. To do this, go to User Settings > Advanced > Developer Mode and enable it. 

<p align="center"><img src="/assets/4.png" alt="Enable Developer Mode" width="600"></p>

6. Go to the server, right click on the channel names and select "Copy Channel ID" to get their IDs. Paste these in your `.env` file.

<p align="center"><img src="/assets/5.png" alt="Copy Channel IDs" width="250"></p>

7. We need to invite the Bot to the server. Go back to the application on the Discord Developer Portal. Go to OAuth2 > OAuth2 URL Generator > Scopes and select "bot". Then, under "Bot Permissions", select the following permissions: `Send Messages`, `Read Message History`, and `Embed Links`.
   
8. Copy the generated URL at the bottom of the page and open it in your web browser. Select the server you want to add the bot to and authorise it.

9. Lastly, we need to add the bot to the private review channel. Go to the server, right click on the `#confessions-review` channel, select "Edit Channel" > "Permissions" > "Add members or roles" and add the bot.

And we are done! Now, you can run your bot by executing the following command in the terminal/command prompt:

```bash
python main.py
```

Your bot should now be online and ready to accept confessions! You can test it by sending a DM to the bot with a confession. The bot should respond with a confirmation message, and the confession should appear in the `#confessions-review` channel for approval.

## The Next Steps

Congratulations on creating your own Discord bot! Feel free to add more features and customize it as you like. You can try adding commands, implement a logging system or even allow anonymous replies (I know, totally original...).

You can also follow Mahad's guide on hosting the bot on Nest [here](https://hackclub.notion.site/converge-nest). Feel free to ask in [#converge](hackclub.slack.com/channels/C091UF79VDM) if you have any questions or need assistance. Happy hacking :D

---

### Appendix: Full Code

```python
import discord
import os
import aiosqlite
from discord.ext import commands
from discord.ui import View, Button, button
from dotenv import load_dotenv

load_dotenv()
TOKEN = os.getenv('DISCORD_TOKEN')
REVIEW_CHANNEL_ID = int(os.getenv('REVIEW_CHANNEL_ID'))
CONFESSIONS_CHANNEL_ID = int(os.getenv('CONFESSIONS_CHANNEL_ID'))

intents = discord.Intents.default()
intents.message_content = True  # Enable Message Content intent
intents.dm_messages = True      # Enable DM Messages intent
intents.guilds = True           # Enable Guilds intent
intents.members = True          # Enable Members intent

bot = commands.Bot(command_prefix="!", intents=intents)

DB_NAME = "confessions.db"

async def init_db():
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS confessions (
                confession_id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                review_message_id INTEGER
            )
        """)
        await db.commit()

async def add_confession(content):
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute("INSERT INTO confessions (content) VALUES (?)", (content,))
        await db.commit()
        return cursor.lastrowid 

async def get_confession(confession_id):
    async with aiosqlite.connect(DB_NAME) as db:
        async with db.execute("SELECT content, status FROM confessions WHERE confession_id = ?", (confession_id,)) as cursor:
            return await cursor.fetchone()

async def update_confession_status(confession_id, status):
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("UPDATE confessions SET status = ? WHERE confession_id = ?", (status, confession_id))
        await db.commit()

class ReviewView(View):
    def __init__(self, confession_id):
        super().__init__(timeout=None) # Persistent view
        self.confession_id = confession_id
        self.approve_button.custom_id = f"approve_{confession_id}"
        self.reject_button.custom_id = f"reject_{confession_id}"

    async def send_to_channels(self, interaction):
        confession_data = await get_confession(self.confession_id)
        if not confession_data:
            await interaction.followup.send("Error: Could not find this confession.", ephemeral=True)
            return

        content, status = confession_data
        
        # Send to public #confessions channel
        confessions_channel = bot.get_channel(CONFESSIONS_CHANNEL_ID)
        if confessions_channel:
            await confessions_channel.send(f"**#{self.confession_id}:** {content}")
        else:
            print(f"Error: Could not find confessions channel with ID {CONFESSIONS_CHANNEL_ID}")
            await interaction.followup.send("Error: Could not find the public confessions channel.", ephemeral=True)
            return
            
        # Update the database
        await update_confession_status(self.confession_id, "approved")

        # Edit the review message
        embed = interaction.message.embeds[0]
        embed.color = discord.Color.green()
        embed.set_footer(text=f"✅ Approved by {interaction.user.display_name}")

        # Disable all buttons
        for item in self.children:
            item.disabled = True
            
        await interaction.message.edit(embed=embed, view=self)


    @button(label="Approve", style=discord.ButtonStyle.green)
    async def approve_button(self, interaction, button):
        await interaction.response.defer() 
        await self.send_to_channels(interaction)

    @button(label="Reject", style=discord.ButtonStyle.red)
    async def reject_button(self, interaction, button):
        await interaction.response.defer()
        await update_confession_status(self.confession_id, "rejected")
        embed = interaction.message.embeds[0]
        embed.color = discord.Color.red()
        embed.set_footer(text=f"❌ Rejected by {interaction.user.display_name}")
        for item in self.children:
            item.disabled = True
        await interaction.message.edit(embed=embed, view=self)

@bot.event
async def on_ready():
    await init_db() # Initialize the database
    print(f'Logged in as {bot.user}')
    print('Bot is ready and database is initialized.')

@bot.event
async def on_message(message):
    # Ignore messages from the bot itself
    if message.author == bot.user:
        return
    
    if isinstance(message.channel, discord.DMChannel):
        try:
            confession_content = message.content
            confession_id = await add_confession(confession_content)
            await message.author.send(f"Your message was staged as **confession #{confession_id}** and will appear in <#{CONFESSIONS_CHANNEL_ID}> if approved.")
            review_channel = bot.get_channel(REVIEW_CHANNEL_ID)
            if review_channel:
                embed = discord.Embed(
                    title=f"New Confession Submission (#{confession_id})",
                    description=confession_content,
                    color=discord.Color.blue()
                )
                view = ReviewView(confession_id)
                await review_channel.send(embed=embed, view=view)
            else:
                print(f"Error: Could not find review channel with ID {REVIEW_CHANNEL_ID}")
                await message.author.send("Sorry, there was an internal error submitting your confession.")

        except Exception as e:
            print(f"Error handling DM: {e}")
            await message.author.send("Sorry, an error occurred while processing your confession. Please try again later.")

bot.run(TOKEN)
```