package utils

import    "time"

/***************************************
	Zulu time utility
****************************************/
func TimeCurrent() (string) {
    timeFormat := "20060102150405Z"
    now := time.Now()
	znow := now.Format(timeFormat)
    return znow
}

func TimeSecondsDiff(date string) (int) {
    timeFormat := "20060102150405Z"
	then, err := time.Parse(timeFormat, date)
    Check(err)
    duration := time.Since(then)
    return int(duration.Seconds())
}

func TimeHoursDiff(date string) (int) {
    timeFormat := "20060102150405Z"
	then, err := time.Parse(timeFormat, date)
    Check(err)
    duration := time.Since(then)
    return int(duration.Hours())
}

func TimeDaysDiff(date string) (int) {
    timeFormat := "20060102150405Z"
	then, err := time.Parse(timeFormat, date)
    Check(err)
    duration := time.Since(then)
    return int(duration.Hours()/24)
}
