/** Routing **/
Router.configure({
  layoutTemplate: 'layout'
});

Router.map(function () {
  /**
   * The route's name is "home"
   * The route's template is also "home"
   * The default action will render the home template
   */
  this.route('home', {
    path: '/',
    template: 'attendeeList'
  });

});

/** Models **/
var Settings = new Meteor.Collection('settings');       // Settings
var Registrants = new Meteor.Collection('registrants'); // Registrants
var Checkins = new Meteor.Collection('checkins');       // Checkins
var attendeeLimit = 10;

if (Meteor.isServer) {
  Meteor.startup(function () {
    Meteor.publish("registrants", function(limit) {
      var registrants = Registrants.find({}, { limit: limit });
      return registrants;
    });
    Meteor.publish("newRegistrant", function(id) {
      var registrants = Registrants.find({"_id": id}, { limit: 1 });
      return registrants;
    });
    Meteor.publish("registrantsSearch", function(query, limit) {
      var registrants = Registrants.find(query, { limit: limit });
      return registrants;
    });
    Meteor.publish("checkins", function() {
      var checkins = Checkins.find();
      return checkins;
    });
    Meteor.publish("settings", function() {
      var settings = Settings.find({name: { $ne: "password" }});
      return settings;
    });
    Meteor.methods({
      passwordIsSet: function() {
        var passwordSetting = Settings.findOne({name: 'password'});
        if (passwordSetting != undefined && passwordSetting.value != undefined) {
          return true;
        }
        else {
          return false;
        }
      },
      removeAllRegistrants: function(password) {
        if (accessChecker(password) === true) {
          return Registrants.remove({});
        }
      },
      removeAllCheckins: function(password) {
        if (accessChecker(password) === true) {
          return Checkins.remove({});
        }
      },
      removeTodaysCheckins: function(password, currentCheckin) {
        if (accessChecker(password) === true) {
          return Checkins.remove({checkinName: currentCheckin});
        }
      },
      pullFromDrupal: function(password, syncURL) {
        if (accessChecker(password) === true) {
          var keepGoing = true;
          var start = 0;
          var limit = 100;
          // Loop through up to 100 AJAX queries of results
          try {
            async.whilst(
                function() {
                  return (start < 100000 && keepGoing); // Stop if we get up to 100,000 registants cause that's nuts.
                },
                function(callback) {
                  var queryURL = syncURL += '&limit='+limit+'&start='+start;
                  console.log("Importing from: "+queryURL);
                  HTTP.get(queryURL, function(err, result) {
                    if (!err && typeof result.data.list == 'object' && Array.isArray(result.data.list)) {
                      for (var i=0; i<result.data.list.length; i++) {
                        if (result.data.list[i].uid == 0) {
                          continue;
                        }
                        var nameFields = getNameFields();
                        var newRegistrant = {
                          uid: result.data.list[i].uid,
                          mail: result.data.list[i].mail,
                          allNames: []
                        }
                        for (var i2=0; i2<nameFields.length; i2++) {
                          if (result.data.list[i][nameFields[i2]]) {
                            if (typeof result.data.list[i][nameFields[i2]] == 'object') {
                              newRegistrant[nameFields[i2]] = result.data.list[i][nameFields[i2]]['und'][0]['value'];
                              newRegistrant.allNames.push(result.data.list[i][nameFields[i2]]['und'][0]['value'].toLowerCase());
                            }
                            else {
                              newRegistrant[nameFields[i2]] = result.data.list[i][nameFields[i2]];
                              newRegistrant.allNames.push(result.data.list[i][nameFields[i2]].toLowerCase());
                            }
                          }
                        }
                        if (newRegistrant['field_profile_first'] && newRegistrant['field_profile_last']) {
                          newRegistrant.allNames.push(newRegistrant['field_profile_first']+' '+newRegistrant['field_profile_last']);
                        }
                        Registrants.insert(newRegistrant);
                      }
                      start = start+limit;
                      console.log("Imported "+result.data.length+" registrants");
                      callback();
                    }
                    else {
                      keepGoing = false;
                      console.log("Error importing: code "+err.response.statusCode);
                      throw err;
                    }
                  });
                },
                function (err) {
                  console.log("Async call failed.");
                }
            );
          }
          catch (e) {
            throw new Meteor.Error(err.response.statusCode, "Failed to import.");
          }
        }
      },
      totalRegistrantCount: function() {
        return Registrants.find().count();
      }
    });
  });
  accessChecker = function(password) {
    var passwordSetting = Settings.findOne({name: 'password'});
    if (passwordSetting.value == password) {
      return true;
    }
    else {
      throw new Meteor.Error(401, "Invalid password");
      return false;
    }
  };
}

if (Meteor.isClient) {
  /** Client Functions **/
  function growl(msg) {
    // If the growler is out, don't let it reset.
    Meteor.clearTimeout(growlTimeout);

    // Set text
    $('.growl .growl-inner').text(msg);

    $('.growl').addClass("throb");
    Meteor.setTimeout(function() {
      $('.growl').removeClass("throb");
    }, 1500);

    // Slide out
    growlTimeout = Meteor.setTimeout(function() {
      $('.growl').addClass("visible");
      growlTimeout = Meteor.setTimeout(function() {
        // Slide back
        $('.growl').removeClass("visible");
      }, 3500);
    }, 5);
  }

  /** Initialize **/
  var today = generateToday();

  var rememberedCheckin = localStorage.getItem('currentCheckin');
  if (rememberedCheckin == null) {
    Session.set("currentCheckin", today);
  }
  else {
    Session.set("currentCheckin", rememberedCheckin);
    Meteor.setTimeout(function() {
      growl('Using remembered check-in: "'+rememberedCheckin+'"');
    }, 1000);
  }

  function animateToNewest() {
    $('html, body').animate({
      scrollTop: $(".attendee:last-of-type").offset().top
    }, 1200);
  }

  var searchTimeout;
  var growlTimeout;
  var loadHandle;

  Template.controlsForm.currentCheckin = Session.get("currentCheckin");
  Template.controlsForm.bulk = Session.get('bulk');
  Meteor.call('passwordIsSet', function(err, data) {
    if (data === true) {
      Session.set('bulk', {
        passwordDisabled: "",
        passwordPlaceholder: ""
      });
    }
    else {
      Session.set('bulk', {
        passwordDisabled: "disabled",
        passwordPlaceholder: "No admin password set!"
      });
    }
  });
  Template.controlsForm.events({
    // INTERFACE
    'click ul#tabs li': function(event, template) {
      $(".controls-form form").hide();
      $(".controls-form form#"+$(event.target).attr('id')+"-form").show();
    },
    'click .button-closeControls': function(event, template) {
      $('.controls-form').hide();
    },
    // NEW USER FORM
    'click .add-submit': function(event, template) {
      event.preventDefault();
      var $form = $(event.target).parents('form').eq(0);
      var newUser = {
        field_profile_first: $form.find('.add-field_profile_first').val(),
        field_profile_last: $form.find('.add-field_profile_last').val(),
        uid: $form.find('.add-uid').val(),
        name: $form.find('.add-username').val(),
        mail: $form.find('.add-email').val()
      }
      var newUserType = {
        "field_profile_first": NonEmptyString,
        "field_profile_last": NonEmptyString,
        "uid": IntegerOrEmpty,
        "name": Match.Optional(String),
        "mail": NonEmptyString
      };

      $form.find('.failed').removeClass('failed');
      try {
        check(newUser, newUserType);
        
        // If no errors...
        newUser = indexNames(newUser);
        Registrants.insert(newUser, function(err, registrantId) {
          if (!err) {
            var timestamp = new Date().getTime();
            var newCheckin = {
              "registrantId": registrantId,
              "checkinName": Session.get("currentCheckin"),
              timestamp: timestamp
            }
            Checkins.insert(newCheckin, function(err, checkinId) {
              if (!err) {
                Meteor.setTimeout(function() {
                  growl("New user added: \""+newUser.field_profile_first+" "+newUser.field_profile_last+"\"");
                }, 500);
                $('.controls-form').hide();
                animateToNewest();
                Meteor.subscribeWithPagination("newRegistrant", registrantId, attendeeLimit);
              }
            });
          }
        });
      }
      catch (e) {
        if (e.path) {
          var $failedItem = $form.find('.add-'+ e.path).eq(0);
          growl(e.message);
          $failedItem.addClass('failed');
        }
      }
    },
    'click #bulk-form #clearRegistrants': function(event, template) {
      event.preventDefault();
      Meteor.call('removeAllRegistrants', $('#bulkPass').val(), function(err, data) {
        if (err) { console.log(err); }
      });
    },
    'click #bulk-form #clearCheckinsAll': function(event, template) {
      event.preventDefault();
      Meteor.call('removeAllCheckins', $('#bulkPass').val(), function(err, data) {
        if (err) { console.log(err); }
      });
    },
    'click #bulk-form #clearCheckinsToday': function(event, template) {
      event.preventDefault();
      Meteor.call('removeTodaysCheckins', $('#bulkPass').val(), Session.get("currentCheckin"), function(err, data) {
        if (err) { console.log(err); }
      });
    },
    'click #bulk-form #pull': function(event, template) {
      event.preventDefault();
      Meteor.call('pullFromDrupal', $('#bulkPass').val(), $('#syncURL').val(), function(err, data) {
        if (err) { console.log(err); }
      });
    },
    // CHECK-IN FORM
    'click #saveCheckin': function(event, template) {
      event.preventDefault();
      var newCheckin = $("#checkinDate").val().toLowerCase();
      Session.set("currentCheckin", newCheckin);
      localStorage.setItem('currentCheckin', newCheckin);
      Meteor.setTimeout(function() {
        growl('Setting check-in to "'+newCheckin+'"');
      }, 10);
      Template.attendeeList.attendees = function() {
        var attendees = loadRegistrants();
        return attendees;
      };
    },
    'click #saveCheckinToday': function(event, template) {
      event.preventDefault();
      var today = generateToday();
      Session.set("currentCheckin", today);
      localStorage.removeItem('currentCheckin');
      Meteor.setTimeout(function() {
        growl('Setting check-in to today\'s date ("'+today+'")');
      }, 10);
      Template.attendeeList.attendees = function() {
        var attendees = loadRegistrants();
        return attendees;
      };
    }
  });

  Template.topSection.events({
    'keyup #searchText': function(event, template) {
      // Clear any existing search timers
      if (searchTimeout) {
        Meteor.clearTimeout(searchTimeout);
      }
      searchTimeout = Meteor.setTimeout(function() {
        Session.set("search_query", event.target.value);
      }, 250);
    },
    'click .button-controls': function(event) {
      $('.controls-form').show();
    },
    'click .button-clear': function(event) {
      $('#searchText').val("");
      Session.set("search_query", "");
    }
  });

  Template.attendeeList.events({
    'click .hereToggle': function(event) {
      var registrant = this;
      // Check whether the person is already Absent or Present
      if (registrant.isHere && registrant.isHere._id) {
        // Present; Handle marking absent
        var cId = registrant.isHere._id;
        Checkins.remove(cId);
      }
      else {
        // Absent; Handle marking present
        var timestamp = new Date().getTime();
        var newCheckin = {registrantId: registrant._id, checkinName: Session.get("currentCheckin"), timestamp: timestamp};
        Checkins.insert(newCheckin, function(err, id) {
          newCheckin._id = id;
          registrant.isHere = newCheckin;
        });
      }
    },
    'click .more-button': function(event) {
      loadHandle.loadNextPage();
      animateToNewest();
      event.preventDefault();
    }
  });

  var loadRegistrants = function () {
    Template.bottom.countCheckedIn = 0;

    var query = {};
    if (Session.get("search_query")) {
      var explodedQuery = Session.get("search_query").split(' ');
      query = {
        "allNames": { $regex: Session.get("search_query"), $options: 'i' }
      };
    }
    Meteor.subscribeWithPagination("registrantsSearch", query, attendeeLimit);
    var registrants = Registrants.find(query)
        .map(function (registrant) {
          // Load checkins relevant to each registrant
          query = {registrantId: registrant._id, checkinName: Session.get("currentCheckin")};
          var isHere = Checkins.findOne(query);

          registrant.classes = 'attendee';
          if (isHere !== undefined) {
            Template.bottom.countCheckedIn = Template.bottom.countCheckedIn + 1;
            registrant.classes += ' isHere-true';
            registrant.isHere = isHere;
          }
          else {
            registrant.classes += ' isHere-false';
          }
          return registrant;
        });

    // Set up how many registrants we've counted.
    Meteor.call('totalRegistrantCount', function(err, data) {
      Session.set("countRegistrantsTotal", data);
    });
    Session.set("countRegistrantsLoaded", registrants.length);
    return registrants;
  };

  Template.attendeeList.attendees = function() {
    return loadRegistrants();
  };
  Template.attendeeList.hasMorePosts = function() {
    return (parseInt(Session.get('countRegistrantsTotal')) >= loadHandle.loaded()) && (parseInt(Session.get('countRegistrantsLoaded')) >= loadHandle.loaded())
  };

  Template.bottom.currentCheckin = function() {
    return Session.get("currentCheckin");
  };
  Template.bottom.countRegistrantsTotal = function() {
    return Session.get("countRegistrantsTotal");
  }
  Template.bottom.countRegistrantsLoaded = function() {
    return Session.get("countRegistrantsLoaded");
  }

  Deps.autorun(function () {
    loadHandle = Meteor.subscribeWithPagination("registrants", attendeeLimit);
    Meteor.subscribe("checkins");
  });
}


/** Helpers **/
function getNameFields() {
  return [
    "field_profile_first",
    "field_profile_last",
    "name"
  ];
}
function indexNames(newUser) {
  var nameFields = getNameFields();

  newUser.allNames = [];
  for (i=0; i<nameFields.length; i++) {
    if (newUser[nameFields[i]]) {
      newUser.allNames.push(newUser[nameFields[i]].toLowerCase());
    }
  }
  if (newUser['field_profile_first'] && newUser['field_profile_last']) {
    newUser.allNames.push(newUser['field_profile_first']+' '+newUser['field_profile_last']);
  }
  return newUser;
}

NonEmptyString = Match.Where(function (x) {
  check(x, String);
  return x.length > 0;
});
IntegerOrEmpty = Match.Where(function (x) {
  if (x.length > 0) {
    x = parseInt(x, 10);
    check(x, Match.Integer);
    return true;
  }
  else {
    return true;
  }
});

function generateToday() {
  var today = new Date();
  today = today.getFullYear()+'-'+('0' + (today.getMonth()+1)).slice(-2)+'-'+('0' + today.getDate()).slice(-2);
  return today;
}