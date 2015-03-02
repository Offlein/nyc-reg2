NYC-Reg
=======
A Meteor-based registration system for NYC Camp (and, I guess, other camps). Written by Craig Leinoff.

Requirements
------------
This is a [Meteor](docs.meteor.com) app, hence it uses MongoDB and NodeJS. It runs on Linux and, I guess, Macs. It also uses the [Meteorite](https://github.com/oortcloud/meteorite) package manager (mrt). There's a Windows version of Meteor but it's kind of a bitch to get Meteorite to work properly and install the required packages. You're best off not trying it.

Installation
------------
1. [Install Meteor based on its instructions](http://docs.meteor.com/#quickstart) 
2. [Install mrt based on its instructions](https://github.com/oortcloud/meteorite#installing-meteorite)
3. Clone this git repository
4. `cd` into the /app directory of this repo.
5. Run the command `mrt install`
6. Run the command `meteor`
7. The app will run on port :3000 by default. Just pull it up in your browser! (Hint: if you're running it locally, go to `http://localhost:3000`

Usage
-----
The NYC-Reg system works best alongside a [Drupal "cod" distribution](https://drupal.org/project/cod). It could work fine without, as long as you get JSON data in a specific way.

You must also install something to get data out of Drupal. The [RESTful Web Services](https://drupal.org/project/restws) module should do this, but more simple is the yet-unreleased `nycreg` module I wrote for the NYC Camp 2014 site. It very simply creates an endpoint and a unique token that the NYC Reg app can be fed to import a list of active users from the site.

###To do the initial Drupal setup using the "nycreg" module:
1. Enable the NYC-Reg module as normal.
2. Visit the administration page `http://yoursite.com/admin/config/services/nycreg`
3. Generate a token.
4. Copy the API endpoint, which should look like: `http://yoursite.com/nycreg/pull/?token=XXXXXXXXXXXXXXX&limit=100&start=0` where XXXXXXXXXXXXXXXXX is your unique token.

###To do the initial NYC-Reg set up:
You'll need to set up a NYC-Reg bulk operations password before importing any data. You do that directly through MongoDB.
1. From a command line separate from where you launched meteor, `cd` into the same /app directory as earlier.
2. Run the command `meteor mongo`. You'll be taken into a MongoDB command line interface.
3. Ensure no password has been set by querying the "settings" database for a "password" variable, like so: `db.settings.find({"name":"password"});`
4. If no password has been set, insert one like this: `db.settings.insert({"name":"password", "value":"my_super_password"});` where "my_super_password" is your super secure password ~~that gets stored in plaintext in this database``.

####To do the initial import from Drupal
1. Pull up the site in your browser, probably at `http://localhost:3000`
2. Click "Controls"
3. Click "Bulk Operations"
4. Type your super secure password into the first textfield -- the "Bulk Operations Password" -- field ~~which doesn't mask your password ... because fuck security~~.
5. In the "Synchronization URL" paste the URL of your Drupal endpoint from before. 
6. If any error occurs, you'll see it in the Meteor command line, which should still be running.
7. Otherwise, you will probably see a few names start appearing immediately. It may take a minute or two for all names to load, and you may need to refresh your browser.

Other Stuff
-----------
By default, you are "checking in" users for a "checkin ID" string matching the current day in the format YYYY-m-dd. You can call your checkins anything you want, however, by going to "Controls" and setting "Change Check-In". You could use a check-in called "First day 2014" for instance; you'll just have to ensure you are checking in users for that day each time you reload the application.

There are also bulk operations to remove all the registrants, to blank out all the check-ins for all days, and to blank out the check-ins for only today. You'll need that "bulk operations password" each time you do any of those, however.

Closing
-------
Contact Craig at [offlein.com](http://offlein.com).
