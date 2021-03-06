import React from 'react';
import moment from 'moment';
import { round } from 'lodash';

const HMS_FORMAT = 'HH:mm:ss';
const MS_FORMAT = 'mm:ss';

const formatDuration = duration => {
  return moment('00:00:00', HMS_FORMAT)
    .add(duration, 'm')
    .format(duration > 60 ? HMS_FORMAT : MS_FORMAT);
};

const WorkoutTile = ({ title, workout }) => (
  <div className="tile">
    <div className="tile__content">
      <div className="tile__title">{title}</div>
      <div className="tile__primary-container">
        <div
          className="tile__primary"
          title={moment
            .utc(workout.endDate)
            .add(moment.parseZone().utcOffset(), 'm')
            .format(`D.M.YYYY ${HMS_FORMAT}`)}
        >
          {moment.utc(workout.endDate).from()}
        </div>
      </div>
      <div className="tile__secondary">{workout.speed || workout.pace}</div>
      <div className="tile__secondary">{`${round(workout.totalDistance, 2)} ${
        workout.totalDistanceUnit
      }`}</div>
      <div className="tile__secondary">{formatDuration(workout.duration)}</div>
      <div className="tile__secondary">{`${workout.totalEnergyBurned} ${
        workout.totalEnergyBurnedUnit
      }`}</div>
    </div>
  </div>
);

export default WorkoutTile;
