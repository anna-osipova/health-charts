const { times, round } = require('lodash');
const moment = require('moment');
const { getWeeklyStats, getMonthlyStats } = require('../helpers/period-stats');

const MIN_YEAR = 2017;
const DISTANCE_UNIT = 'km';
const getTotalDistance = (total, { totalDistance }) => total + totalDistance;

module.exports = {
  Query: {
    runningWorkouts: (parent, args, context) =>
      context.prisma.runningWorkouts({ where: { userId: context.user.id } }),
    runningWorkout: (parent, { id }, context) => context.prisma.runningWorkout({ id }),
    runningTotalsByDay: async (parent, args, context) => {
      const now = moment.utc().startOf('year');
      const rawWorkouts = await context.prisma.runningWorkouts({
        where: {
          startDate_gt: `${MIN_YEAR}-01-01`,
          userId: context.user.id
        }
      });
      const workouts = rawWorkouts.map(workout => {
        const startDate = moment.utc(workout.startDate);
        const dayOfYear = startDate.dayOfYear();
        return {
          ...workout,
          year: startDate.get('year'),
          day: !startDate.isLeapYear() && dayOfYear > 59 ? dayOfYear + 1 : dayOfYear
        };
      });
      return times(now.get('year') - MIN_YEAR + 1, yearOffset => {
        const currentYear = MIN_YEAR + yearOffset;
        const allDays = times(366);
        const yearWorkouts = workouts.filter(({ year }) => year === currentYear);
        const yearlyTotalDistance = yearWorkouts.reduce(getTotalDistance, 0);
        let totalDistance = 0;
        const days = allDays.map(dayIndex => {
          const monthWorkouts = yearWorkouts.filter(({ day }) => day === dayIndex);
          (totalDistance += monthWorkouts.reduce(getTotalDistance, 0)), 2;
          return {
            day: dayIndex,
            totalDistance: round(totalDistance),
            totalDistanceUnit: DISTANCE_UNIT,
            runningWorkouts: monthWorkouts
          };
        });
        return {
          days,
          year: currentYear,
          totalDistance: round(yearlyTotalDistance, 2),
          totalDistanceUnit: DISTANCE_UNIT
        };
      });
    },
    runningTotalsByMonth: async (parent, args, context) => {
      const now = moment.utc().startOf('year');
      const allMonths = times(12);
      const rawWorkouts = await context.prisma.runningWorkouts({
        where: {
          startDate_gt: `${MIN_YEAR}-01-01`,
          userId: context.user.id
        }
      });
      const workouts = rawWorkouts.map(workout => {
        const startDate = moment.utc(workout.startDate);
        return {
          ...workout,
          year: startDate.get('year'),
          month: startDate.get('month')
        };
      });
      return times(now.get('year') - MIN_YEAR + 1, yearOffset => {
        const currentYear = MIN_YEAR + yearOffset;
        const yearWorkouts = workouts.filter(({ year }) => year === currentYear);
        const yearlyTotalDistance = yearWorkouts.reduce(getTotalDistance, 0);
        const months = allMonths.map(monthIndex => {
          const monthWorkouts = yearWorkouts.filter(({ month }) => month === monthIndex);
          const totalDistance = round(monthWorkouts.reduce(getTotalDistance, 0), 2);
          return {
            month: monthIndex,
            totalDistance,
            totalDistanceUnit: DISTANCE_UNIT,
            runningWorkouts: monthWorkouts
          };
        });
        return {
          months,
          year: currentYear,
          totalDistance: round(yearlyTotalDistance, 2),
          totalDistanceUnit: DISTANCE_UNIT
        };
      });
    }
  },
  Mutation: {
    createRunningWorkout(parent, workout, context) {
      return context.prisma.createRunningWorkout({
        ...workout
      });
    }
  },
  Workout: {
    pace: ({ duration, totalDistance, totalDistanceUnit }) => {
      const pace = duration / totalDistance;
      const formattedPace = moment('0:0:0', 'H:m:s')
        .add(pace, 'm')
        .format('mm:ss');
      return `${formattedPace} min/${totalDistanceUnit}`;
    }
  },
  Stats: {
    runningStats: () => ({})
  },
  RunningStats: {
    monthlyStats: async (parent, args, context) => getMonthlyStats(context.prisma, 'running'),
    weeklyStats: async (parent, args, context) => getWeeklyStats(context.prisma, 'running'),
    recentWorkouts: (parent, { limit }, context) =>
      context.prisma.runningWorkouts({
        orderBy: 'startDate_DESC',
        first: limit,
        where: { userId: context.user.id }
      }),
    recentWorkout: async (parent, args, context) => {
      const workouts = await context.prisma.runningWorkouts({
        orderBy: 'startDate_DESC',
        first: 1,
        where: { userId: context.user.id }
      });
      if (workouts.length) {
        return workouts[0];
      }
      return null;
    }
  }
};
