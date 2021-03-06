const fetch = require('node-fetch');
const moment = require('moment');
const { maxBy } = require('lodash');
const { prisma } = require('./generated/prisma-client');
const { checkAccessToken } = require('./strava-oauth');
require('dotenv').config();

async function* fetchActivities({ accessToken, userId, fetchAll = false }) {
  const [latestCycling] = await prisma.cyclingWorkouts({
    orderBy: 'startDate_ASC',
    last: 1,
    where: { userId }
  });
  const [latestRunning] = await prisma.runningWorkouts({
    orderBy: 'startDate_ASC',
    last: 1,
    where: { userId }
  });
  const latest = maxBy([latestCycling, latestRunning], 'startDate');
  let startDate =
    moment
      .utc(!fetchAll && latest ? latest.startDate : '2017-01-01')
      .add(-14, 'd')
      .valueOf() / 1000;
  let hasData = true;
  while (hasData) {
    console.log(`Fetching data after ${moment(startDate * 1000).format()}`);
    const response = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${startDate}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );
    if (response.status === 401) {
      throw new Error('STRAVA_UNAUTHORIZED');
    }
    if (response.status === 429) {
      throw new Error('STRAVA_TOO_MANY_REQUEST');
    }
    const activityList = await response.json();
    if (!activityList.length) {
      hasData = false;
    } else {
      startDate = moment.utc(maxBy(activityList, 'start_date').start_date).valueOf() / 1000;
      yield activityList;
    }
  }
}

module.exports = async userFromDb => {
  try {
    const user = await checkAccessToken(userFromDb);
    const { accessToken, id: userId } = user;
    let counter = 0;

    for await (let activities of fetchActivities({ accessToken, userId })) {
      await Promise.all(
        activities.map(async ({ id, type, start_date }) => {
          const startDate = moment.utc(start_date).format();

          if (type === 'Run') {
            const existingEntry = await prisma.runningWorkouts({
              where: { stravaId: `${id}` }
            });
            if (!existingEntry.length) {
              const response = await fetch(`https://www.strava.com/api/v3/activities/${id}`, {
                headers: { Authorization: `Bearer ${accessToken}` }
              });
              const activity = await response.json();

              try {
                await prisma.createRunningWorkout({
                  userId,
                  stravaId: `${activity.id}`,
                  startDate: moment.utc(activity.start_date).format(),
                  endDate: moment
                    .utc(activity.start_date)
                    .add(activity.elapsed_time, 's')
                    .format(),
                  totalDistance: activity.distance / 1000,
                  totalDistanceUnit: 'km',
                  duration: activity.moving_time / 60,
                  totalAscent: activity.total_elevation_gain / 1000,
                  totalAscentUnit: 'km',
                  totalEnergyBurned: activity.calories,
                  totalEnergyBurnedUnit: 'kcal',
                  sourceName: 'strava'
                });
                counter++;
                console.log(`Processed run stravaId=${activity.id} from ${startDate}`);
              } catch (err) {
                console.log(`Error in stravaId=${activity.id}`);
                console.log(err);
              }
            }
          }

          if (type === 'Ride') {
            const existingEntry = await prisma.cyclingWorkouts({
              where: { stravaId: `${id}` }
            });
            if (!existingEntry.length) {
              const response = await fetch(`https://www.strava.com/api/v3/activities/${id}`, {
                headers: { Authorization: `Bearer ${accessToken}` }
              });
              const activity = await response.json();

              await prisma.createCyclingWorkout({
                userId,
                stravaId: `${activity.id}`,
                startDate,
                endDate: moment
                  .utc(activity.start_date)
                  .add(activity.elapsed_time, 's')
                  .format(),
                totalDistance: activity.distance / 1000,
                totalDistanceUnit: 'km',
                duration: activity.moving_time / 60,
                totalAscent: activity.total_elevation_gain / 1000,
                totalAscentUnit: 'km',
                totalEnergyBurned: activity.calories,
                totalEnergyBurnedUnit: 'kcal',
                sourceName: 'strava'
              });
              counter++;
              console.log(`Processed ride stravaId=${activity.id} from ${startDate}`);
            }
          }
        })
      );
    }

    console.log(`Imported ${counter} activities`);
  } catch (err) {
    console.error(`Error while importing`, err);
  }
};

module.exports.fetchActivities = fetchActivities;
